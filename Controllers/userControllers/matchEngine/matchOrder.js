const Order = require("../../../Modules/userModule/tradeOrder");
const updateBalance = require("../../../Modules/userModule/userBalance");
const pairData = require("../../../Modules/userModule/pairData");
const MappingOrders = require('../../../Modules/userModule/MappingOrders');
const { userUpdateBalance } = require('../userController');


function toDecimalString(num) {
  if (typeof num === 'bigint') return num.toString();

  const str = typeof num === 'number' ? num.toString() : num;

  if (!str.includes('e')) return str;

  return Number(str).toLocaleString('fullwide', { useGrouping: false });
}

function subtractExact(a, b) {
  const [aInt, aDec = ''] = toDecimalString(a).split('.');
  const [bInt, bDec = ''] = toDecimalString(b).split('.');

  const decLength = Math.max(aDec.length, bDec.length);

  const aFull = BigInt(aInt + aDec.padEnd(decLength, '0'));
  const bFull = BigInt(bInt + bDec.padEnd(decLength, '0'));

  const result = (aFull - bFull).toString();

  if (decLength === 0) return result;

  const paddedResult = result.padStart(decLength + 1, '0');
  const intPart = paddedResult.slice(0, -decLength) || '0';
  const decPart = paddedResult.slice(-decLength).replace(/0+$/, '');

  return decPart ? `${intPart}.${decPart}` : intPart;
}



function toPlainString(num) {
  if (Math.abs(num) < 1.0) {
    let e = parseInt(num.toString().split("e-")[1]);
    if (e) {
      num *= Math.pow(10, e - 1);
      return "0." + "0".repeat(e - 1) + num.toString().substring(2);
    }
  } else {
    let e = parseInt(num.toString().split("+")[1]);
    if (e > 20) {
      e -= 20;
      num /= Math.pow(10, e);
      return num.toString() + "0".repeat(e);
    }
  }
  return num.toString();
}

function addExact(a, b) {
  const aStr = toPlainString(a);
  const bStr = toPlainString(b);

  const [aInt, aDec = ''] = aStr.split('.');
  const [bInt, bDec = ''] = bStr.split('.');

  const decLength = Math.max(aDec.length, bDec.length);
  const aFull = BigInt(aInt + aDec.padEnd(decLength, '0'));
  const bFull = BigInt(bInt + bDec.padEnd(decLength, '0'));

  const sum = aFull + bFull;
  const sumStr = sum.toString().padStart(decLength + 1, '0');

  if (decLength === 0) {
    return sumStr;
  }

  const intPart = sumStr.slice(0, -decLength) || '0';
  const decPart = sumStr.slice(-decLength).replace(/0+$/, '');

  return decPart ? `${intPart}.${decPart}` : intPart;
}


const matchOrder = async (order, id, io) => {
  try {
    const orderDoc = await Order.findById(order._id);
    if (!orderDoc) throw new Error("Order not found");

    const matchQuery = {
      pair: orderDoc.pair,
      type: orderDoc.type === "buy" ? "sell" : "buy",
      status: { $in: ["active", "partially", "pending"] },
      isProcessing: { $ne: true } // Only match orders not being processed
    };

    const sortOrder = orderDoc.type === "buy" ? { price: 1, dateTime: 1 } : { price: -1, dateTime: 1 };
    const matchingOrders = await Order.find(matchQuery).sort(sortOrder);

    if (orderDoc.orderType === "market") {
      await marketorder(orderDoc, matchingOrders, io);
      return;
    }

    let matchFound = false;

    for (const matchedOrder of matchingOrders) {
      // Apply soft lock on matchedOrder
      const lockedMatchedOrder = await Order.findOneAndUpdate(
        { _id: matchedOrder._id, isProcessing: { $ne: true } },
        { $set: { isProcessing: true } },
        { new: true }
      );

      if (!lockedMatchedOrder) {
        console.log(`Matched order ${matchedOrder._id} is already being processed.`);
        continue;
      }

      const refreshedOrder = await Order.findById(orderDoc._id);
      if (!refreshedOrder || refreshedOrder.status === "filled" || refreshedOrder.pendingAmnt <= 0) {
        await Order.findByIdAndUpdate(lockedMatchedOrder._id, { $unset: { isProcessing: "" } });
        break;
      }

      if (refreshedOrder.orderType === "limit") {
        if (refreshedOrder.type === "buy" && lockedMatchedOrder.price > refreshedOrder.price) {
          await Order.findByIdAndUpdate(lockedMatchedOrder._id, { $unset: { isProcessing: "" } });
          break;
        }
        if (refreshedOrder.type === "sell" && lockedMatchedOrder.price < refreshedOrder.price) {
          await Order.findByIdAndUpdate(lockedMatchedOrder._id, { $unset: { isProcessing: "" } });
          break;
        }
      }

      const tradeAmount = Math.min(lockedMatchedOrder.pendingAmnt, refreshedOrder.pendingAmnt);
      const remainingAmount = subtractExact(refreshedOrder.pendingAmnt, tradeAmount);
      const updatedFilledAmount = addExact(refreshedOrder.filledAmount, tradeAmount);

      const matchedRemaining = subtractExact(lockedMatchedOrder.pendingAmnt, tradeAmount);
      const matchedFilledAmount = addExact(lockedMatchedOrder.filledAmount, tradeAmount);

      // Update matched order
      await Order.findByIdAndUpdate(lockedMatchedOrder._id, {
        $set: {
          filledAmount: matchedFilledAmount,
          pendingAmnt: matchedRemaining,
          status: matchedRemaining <= 0 ? "filled" : "partially",
          updateAt: new Date(),
          isProcessed: true,
          isProcessing: false
        }
      });

      // Update main order
      await Order.findByIdAndUpdate(refreshedOrder._id, {
        $set: {
          filledAmount: updatedFilledAmount,
          pendingAmnt: remainingAmount,
          status: remainingAmount <= 0 ? "filled" : "partially",
          updateAt: new Date(),
          isProcessed: true
        }
      });

      // Call balance update logic
      await userBalanceUpdation(refreshedOrder, id, lockedMatchedOrder, tradeAmount, io);

      // Notify user

      const base = orderDoc.pairName.slice(0, -4);
      const quote = orderDoc.pairName.slice(-4);

      // console.log(refreshedOrder.userId.toString(),lockedMatchedOrder.userId.toString());

      io.to(refreshedOrder.userId.toString()).emit("tradeSuccess", {
        status: 1,
        msg: `Your ${refreshedOrder.type.toUpperCase()} order for ${tradeAmount} ${base}/${quote} at price ${lockedMatchedOrder.price} has been filled.`
      });

      // Message for matched order user
      io.to(lockedMatchedOrder.userId.toString()).emit("tradeSuccess", {
        status: 1,
        msg: `Your ${lockedMatchedOrder.type.toUpperCase()} order for ${tradeAmount} ${base}/${quote} at price ${lockedMatchedOrder.price} has been filled.`
      });

      io.emit("tradeSuccess", { status: 1, });
      io.emit("tradeSuccessApp", { status: 1, });


      matchFound = true;

      if (remainingAmount <= 0) {
        break;
      }

      // Recheck in case it’s filled in the meantime
      const checkAgain = await Order.findById(orderDoc._id);
      if (!checkAgain || checkAgain.pendingAmnt <= 0 || checkAgain.status === "filled") break;
    }



    if (!matchFound) {
      console.log("No match found for order:", orderDoc._id);
    }

  } catch (error) {
    console.error("Error in matchOrder:", error);
  }
};


const marketorder = async (orderDoc, matchedOrders, io) => {
  // console.log("orderDoc--",orderDoc.type);

  try {
    let orderPendingAmount = orderDoc.pendingAmnt || orderDoc.amount;
    let baseCoin = orderDoc.pairName.substring(0, 3);
    if (baseCoin === "ADA") baseCoin = "CARDONA";
    const quoteCoin = "USDT";

    const getPairData = await pairData.findOne({ symbol: orderDoc.pairName });
    const makerFeeRate = getPairData.makerFee / 100; // 0.05/100 = 0.0005
    const takerFeeRate = getPairData.takerFee / 100; //0.25/100 = 0.0025

    let totalFilled = 0;
    let totalSpent = 0;

    for (const matchedOrder of matchedOrders) {
      const tradePrice = matchedOrder.price;
      let matchedOrderPendingAmount = matchedOrder.pendingAmnt;
      let filledAmount = 0;
      let filledTotalUsd = 0;

      if (orderDoc.type === "buy") {

        const buyerBalanceDoc = await updateBalance.findOne({ userId: orderDoc.userId });
        const buyerUsdtBalance = buyerBalanceDoc?.USDT_Balance || 0;

        if (buyerUsdtBalance <= 0 || orderPendingAmount <= 0) break;

        filledAmount = Math.min(
          matchedOrderPendingAmount,
          orderPendingAmount,
          buyerUsdtBalance / tradePrice
        );

        if (filledAmount <= 0) continue;

        filledTotalUsd = filledAmount * tradePrice;
        orderPendingAmount = subtractExact(orderPendingAmount, filledAmount);
        matchedOrderPendingAmount = subtractExact(matchedOrderPendingAmount, filledAmount);
        totalFilled = addExact(totalFilled, filledAmount);
        totalSpent = addExact(totalSpent, filledTotalUsd);

        const buyOrder = orderDoc;
        const sellOrder = matchedOrder;
        const isBuyMaker = buyOrder.dateTime < sellOrder.dateTime;

        let buyFee = 0;
        let sellFee = 0;



        if (buyOrder.dateTime < sellOrder.dateTime) {
          // Buyer is maker
          buyFee = makerFeeRate * filledTotalUsd;
          sellFee = takerFeeRate * filledAmount;
        } else {
          // Seller is maker
          buyFee = takerFeeRate * filledAmount;
          sellFee = makerFeeRate * filledTotalUsd;
        }

        // const buyFee = (isBuyMaker ? makerFeeRate : takerFeeRate) * filledAmount;
        // const sellFee = (isBuyMaker ? takerFeeRate : makerFeeRate) * filledTotalUsd;


        const buyerBefore = await updateBalance.findOne({ userId: buyOrder.userId });
        const sellerBefore = await updateBalance.findOne({ userId: sellOrder.userId });

        const beforeUsdtBal = sellerBefore?.USDT_Balance || 0;
        const beforePairBal = buyerBefore?.[`${baseCoin}_Balance`] || 0;

        await Promise.all([
          Order.findByIdAndUpdate(buyOrder._id, {
            $set: {
              filledAmount: (buyOrder.filledAmount || 0) + filledAmount,
              pendingAmnt: orderPendingAmount,
              fee: buyFee,
              feeStatus: isBuyMaker ? "maker" : "taker",
              status: orderPendingAmount > 0 ? "partially" : "filled",
              updateAt: new Date(),
            },
          }),
          Order.findByIdAndUpdate(sellOrder._id, {
            $set: {
              filledAmount: (sellOrder.filledAmount || 0) + filledAmount,
              pendingAmnt: matchedOrderPendingAmount,
              fee: sellFee,
              feeStatus: isBuyMaker ? "taker" : "maker",
              status: matchedOrderPendingAmount > 0 ? "partially" : "filled",
              updateAt: new Date(),
            },
          }),


          userUpdateBalance(sellOrder.userId, quoteCoin, filledTotalUsd - sellFee, "add"),
          userUpdateBalance(buyOrder.userId, baseCoin, filledAmount - buyFee, "add"),
          userUpdateBalance(buyOrder.userId, quoteCoin, filledTotalUsd, "sub"),
        ]);

        const buyerAfter = await updateBalance.findOne({ userId: buyOrder.userId });
        const sellerAfter = await updateBalance.findOne({ userId: sellOrder.userId });

        await MappingOrders.create({
          buyOrderId: buyOrder._id,
          buyerUserId: buyOrder.userId,
          buyPrice: buyOrder.price,
          sellOrderId: sellOrder._id,
          sellerUserId: sellOrder.userId,
          sellPrice: sellOrder.price,
          tradePrice,
          filledAmount,
          pair: orderDoc.pair,
          pairName: orderDoc.pairName,
          total: filledTotalUsd,
          buyFee,
          sellFee,
          role: isBuyMaker ? "maker" : "taker",
          orderType: orderDoc.orderType,
          orderState: orderDoc.type,
          dateTime: new Date(),
          beforeUsdtBal,
          afterUsdtBal: sellerAfter?.USDT_Balance || 0,
          beforePairBal,
          afterPairBal: buyerAfter?.[`${baseCoin}_Balance`] || 0,
        });

        io.to(buyOrder.userId.toString()).emit("tradeSuccess", {status: 1,});
        io.to(sellOrder.userId.toString()).emit("tradeSuccess", {status: 1,});

        io.emit("tradeSuccessApp", { status: 1, });

        if (orderPendingAmount <= 0) break;
      } else {
        const sellerBalanceDoc = await updateBalance.findOne({ userId: orderDoc.userId });
        const sellerBaseBalance = sellerBalanceDoc?.[`${baseCoin}_Balance`] || 0;

        if (sellerBaseBalance <= 0 || orderPendingAmount <= 0) break;

        filledAmount = Math.min(
          matchedOrderPendingAmount,
          orderPendingAmount,
          sellerBaseBalance
        );

        if (filledAmount <= 0) continue;

        filledTotalUsd = filledAmount * tradePrice;
        orderPendingAmount = subtractExact(orderPendingAmount, filledAmount);
        matchedOrderPendingAmount = subtractExact(matchedOrderPendingAmount, filledAmount);
        totalFilled = addExact(totalFilled, filledAmount);
        totalSpent = addExact(totalSpent, filledTotalUsd);

        const sellOrder = orderDoc;
        const buyOrder = matchedOrder;
        const isSellMaker = sellOrder.dateTime < buyOrder.dateTime;

        let sellFee = 0;
        let buyFee = 0;


        if (sellOrder.dateTime < buyOrder.dateTime) {
          // Seller is maker
          sellFee = makerFeeRate * filledTotalUsd;
          buyFee = takerFeeRate * filledAmount;
        } else {
          // Buyer is maker
          sellFee = takerFeeRate * filledTotalUsd;
          buyFee = makerFeeRate * filledAmount;
        }

        const sellerBefore = await updateBalance.findOne({ userId: sellOrder.userId });

        const buyerBefore = await updateBalance.findOne({ userId: buyOrder.userId });
        const beforePairBal = buyerBefore?.[`${baseCoin}_Balance`] || 0;
        const beforeUsdtBal = sellerBefore?.USDT_Balance || 0;

        await Promise.all([
          Order.findByIdAndUpdate(sellOrder._id, {
            $set: {
              filledAmount: (sellOrder.filledAmount || 0) + filledAmount,
              pendingAmnt: orderPendingAmount,
              fee: sellFee,
              feeStatus: isSellMaker ? "maker" : "taker",
              status: orderPendingAmount > 0 ? "partially" : "filled",
              updateAt: new Date(),
            },
          }),
          Order.findByIdAndUpdate(buyOrder._id, {
            $set: {
              filledAmount: (buyOrder.filledAmount || 0) + filledAmount,
              pendingAmnt: matchedOrderPendingAmount,
              fee: buyFee,
              feeStatus: isSellMaker ? "taker" : "maker",
              status: matchedOrderPendingAmount > 0 ? "partially" : "filled",
              updateAt: new Date(),
            },
          }),


          userUpdateBalance(buyOrder.userId, baseCoin, filledAmount - buyFee, "add"),
          userUpdateBalance(sellOrder.userId, quoteCoin, filledTotalUsd - sellFee, "add"),
          userUpdateBalance(sellOrder.userId, baseCoin, filledAmount, "sub"),
        ]);

        const buyerAfter = await updateBalance.findOne({ userId: buyOrder.userId });
        const sellerAfter = await updateBalance.findOne({ userId: sellOrder.userId });
        const afterPairBal = buyerAfter?.[`${baseCoin}_Balance`] || 0;
        const afterUsdtBal = sellerAfter?.USDT_Balance || 0;

        await MappingOrders.create({
          buyOrderId: buyOrder._id,
          buyerUserId: buyOrder.userId,
          buyPrice: buyOrder.price,
          sellOrderId: sellOrder._id,
          sellerUserId: sellOrder.userId,
          sellPrice: sellOrder.price,
          tradePrice,
          filledAmount,
          pair: orderDoc.pair,
          pairName: orderDoc.pairName,
          total: filledTotalUsd,
          buyFee,
          sellFee,
          role: isSellMaker ? "maker" : "taker",
          orderType: orderDoc.orderType,
          orderState: orderDoc.type,
          dateTime: new Date(),
          beforeUsdtBal: beforeUsdtBal,
          afterUsdtBal: afterUsdtBal,
          beforePairBal: beforePairBal,
          afterPairBal: afterPairBal,
        });


        io.to(buyOrder.userId.toString()).emit("tradeSuccess", {status: 1});
        io.to(sellOrder.userId.toString()).emit("tradeSuccess", {status: 1});

        io.emit("tradeSuccessApp", {status: 1});

        if (orderPendingAmount <= 0) break;
      }
    }

    const matched = orderDoc.amount - orderPendingAmount;
    // console.log("matched--", matched);

    if (orderPendingAmount > 0) {
      await Order.findByIdAndUpdate(orderDoc._id, {
        $set: {
          status: matched > 0 ? "filled" : "notMatch",
          pendingAmnt: 0,
        },
      });

      if (matched === 0) {
        io.to(orderDoc.userId.toString()).emit("tradeSuccess", {
          status: 0,
          msg: `Your market ${orderDoc.type} order could not be matched.`,
        });
        io.emit("tradeSuccessApp", {status: 1});
      } else {
        if (orderDoc.type === "buy") {
          io.to(orderDoc.userId.toString()).emit("tradeSuccess", {
            status: 0,
            msg: `Market buy filled.`,
          });
          io.emit("tradeSuccessApp", {status: 1});
        } else {
          io.to(orderDoc.userId.toString()).emit("tradeSuccess", {
            status: 2,
            msg: `Market sell filled.`,
          });
          io.emit("tradeSuccessApp", {status: 1});
        }
      }
    } else {
      await Order.findByIdAndUpdate(orderDoc._id, {
        $set: { status: "filled" },
      });

      io.to(orderDoc.userId.toString()).emit("tradeSuccess", {
        status: 1,
        msg: "Market order filled.",
      });
      io.emit("tradeSuccessApp", {status: 1});
    }

  } catch (error) {
    console.error("Error in marketorder:", error);
  }
};



const userBalanceUpdation = async (orders, userId, matchOrderId, tradeAmount, io) => {
  try {
    const getPairData = await pairData.findOne({ symbol: orders.pairName });
    let baseCoin = orders.pairName.substring(0, 3) === "ADA" ? "CARDONA" : orders.pairName.substring(0, 3);
    const quoteCoin = "USDT";

    const tradePrice = matchOrderId.price;
    const filledAmount = parseFloat(tradeAmount);
    const total = parseFloat((tradePrice * filledAmount).toFixed(8));

    const buyOrder = orders.type === "buy" ? orders : matchOrderId;
    const sellOrder = orders.type === "sell" ? orders : matchOrderId;

    const isBuyMaker = buyOrder.dateTime < sellOrder.dateTime;
    const makerFeeRate = getPairData.makerFee / 100;
    const takerFeeRate = getPairData.takerFee / 100;

    const buyFee = (isBuyMaker ? filledAmount * makerFeeRate : filledAmount * takerFeeRate);
    const sellFee = (isBuyMaker ? total * takerFeeRate : total * makerFeeRate);

    const creditToBuyer = parseFloat((filledAmount - buyFee).toFixed(8));
    const creditToSeller = parseFloat((total - sellFee).toFixed(8));

    // Fetch balances BEFORE update
    const buyerBalanceBefore = await updateBalance.findOne({ userId: buyOrder.userId });
    const sellerBalanceBefore = await updateBalance.findOne({ userId: sellOrder.userId });
    const beforeUsdtBal = sellerBalanceBefore?.USDT_Balance || 0;
    const beforePairBal = buyerBalanceBefore?.[`${baseCoin}_Balance`] || 0;

    // Atomic balance update
    await Promise.all([
      updateBalance.updateOne(
        { userId: buyOrder.userId },
        { $inc: { [`${baseCoin}_Balance`]: creditToBuyer } }
      ),
      updateBalance.updateOne(
        { userId: sellOrder.userId },
        { $inc: { [`${quoteCoin}_Balance`]: creditToSeller } }
      )
    ]);

    // Fetch balances AFTER update
    const buyerBalanceAfter = await updateBalance.findOne({ userId: buyOrder.userId });
    const sellerBalanceAfter = await updateBalance.findOne({ userId: sellOrder.userId });
    const afterUsdtBal = sellerBalanceAfter?.USDT_Balance || 0;
    const afterPairBal = buyerBalanceAfter?.[`${baseCoin}_Balance`] || 0;

    // Update Orders
    await Promise.all([
      Order.updateOne(
        { _id: buyOrder._id },
        {
          $inc: { creditAmount: creditToBuyer },
          $set: {
            fee: parseFloat(buyFee.toFixed(8)),
            feeStatus: isBuyMaker ? "maker" : "taker"
          }
        }
      ),
      Order.updateOne(
        { _id: sellOrder._id },
        {
          $inc: { creditAmount: creditToSeller },
          $set: {
            fee: parseFloat(sellFee.toFixed(8)),
            feeStatus: isBuyMaker ? "taker" : "maker"
          }
        }
      )
    ]);

    // Save Trade Mapping
    await MappingOrders.create({
      buyOrderId: buyOrder._id,
      buyerUserId: buyOrder.userId,
      buyPrice: buyOrder.price,
      sellOrderId: sellOrder._id,
      sellerUserId: sellOrder.userId,
      sellPrice: sellOrder.price,
      tradePrice,
      filledAmount,
      pair: buyOrder.pair,
      pairName: buyOrder.pairName,
      total,
      buyFee: parseFloat(buyFee.toFixed(8)),
      sellFee: parseFloat(sellFee.toFixed(8)),
      role: isBuyMaker ? "maker" : "taker",
      orderType: orders.orderType,
      orderState: orders.type,
      dateTime: new Date(),
      beforeUsdtBal,
      afterUsdtBal,
      beforePairBal,
      afterPairBal
    });

    if (orders.type === "buy" && orders.orderType === "limit") {
      if (orders.price > tradePrice) {
        const refund = parseFloat(((orders.price - tradePrice) * filledAmount).toFixed(8));

        await updateBalance.updateOne(
          { userId: orders.userId },
          { $inc: { USDT_Balance: refund } }
        );
      }
    }

    console.log("✅ User balances updated and trade mapped.");
  } catch (error) {
    console.error("❌ Error in userBalanceUpdation:", error);
  }
};


module.exports = { matchOrder, userBalanceUpdation, marketorder };






