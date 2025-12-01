const Coindata = require('../../Modules/userModule/pairData');
const WebSocket = require('ws');
const mongoose = require('mongoose');
const OrderBook = require('../../Modules/userModule/OrdeBook')
const Order = require("../../Modules/userModule/tradeOrder");
const { NumberListInstance } = require('twilio/lib/rest/pricing/v2/voice/number');
const { default: axios } = require('axios');
const config = require('../../Config/config');
const userBalance = require("../../Modules/userModule/userBalance");
const updateBalance = require('../../Modules/userModule/userBalance');
const { userUpdateBalance } = require("./userController");
const TotalAssetChart = require('../../Modules/userModule/userTotalAsset')
const pairData = require('../../Modules/userModule/pairData');
const MappingOrders = require('../../Modules/userModule/MappingOrders');
const cron = require("node-cron");
const TradeOrderHistory = require("../../Modules/userModule/tradeOrder");
const socketHelper = require("../socket/socketCommon");
const io = socketHelper.GetSocket();
const { map } = require('litecore-lib/lib/opcode');
const { orderQueue, orderQueue1, getQueueEvents } = require("../../helper/orderQueue");
const { startWorker, startWorker1 } = require("../../Controllers/userControllers/matchOrderWorker");
const { OpenOrderData, recentOrder } = require('./user_getMethods');


let socket;
const SocketInit = (socketIO) => {
  socket = socketIO;
};

const Coincreate = (async (req, res) => {
  const { symbol, name, logo } = req.body
  const User = new Coindata({
    symbol, name, logo
  })
  try {
    const value = await User.save();
    res.status(200).send({ status: true, message: "created successfully", value });
  } catch (error) {
    // console.log('error', error)
    res.status(200).send({ status: false, message: "Error" })
  }
})


// Binance WebSocket URL

let socketConnections = {};
const activeSockets = {};


function subtractExact(a, b) {
  const [aInt, aDec = ''] = a.toString().split('.');
  const [bInt, bDec = ''] = b.toString().split('.');

  const decLength = Math.max(aDec.length, bDec.length);
  const aFull = BigInt(aInt + aDec.padEnd(decLength, '0'));
  const bFull = BigInt(bInt + bDec.padEnd(decLength, '0'));

  const result = (aFull - bFull).toString().padStart(decLength + 1, '0');
  const intPart = result.slice(0, -decLength) || '0';
  const decPart = result.slice(-decLength).replace(/0+$/, '');

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

function cleanFloat(num, precision = 10) {
  return Number(num.toPrecision(precision));
}


const fetchPairData = async (socketData) => {
  try {
    const dbSymbols = await Coindata.find();

    if (!dbSymbols.length) {
      console.log("No symbols found in database.");
      return;
    }

    dbSymbols.forEach((data) => {
      let symbol = data.symbol?.toLowerCase();
      if (!symbol) {
        console.log("Invalid symbol in database:", data);
        return;
      }

      if (socketConnections[symbol]) {
        console.log(`WebSocket already exists for ${symbol}`);
        return;
      }

      const BINANCE_WS_URL = "wss://data-stream.binance.vision/ws";
      // console.log(`Connecting WebSocket for ${symbol}...`);
      const ws = new WebSocket(BINANCE_WS_URL);

      socketConnections[symbol] = ws;

      ws.on("open", () => {
        const payload = {
          method: "SUBSCRIBE",
          params: [`${symbol}@ticker`],
          id: 1,
        };
        ws.send(JSON.stringify(payload));
      });

      ws.on("message", async (event) => {
        try {
          const symbolData = JSON.parse(event);
          // console.log('symbolData', symbolData)
          if (symbolData && symbolData.s && symbolData.s.toLowerCase() === symbol) {
            const updatedData = {
              current_price: symbolData.c || 0,
              highest_price: symbolData.h || 0,
              lowest_price: symbolData.l || 0,
              volume: symbolData.v || 0,
              volume_24h_USDT: symbolData.q || 0,
              change_24h: symbolData?.p || 0,
              change_percentage: symbolData?.P || 0,
              time: new Date(),
            };

            await Coindata.findOneAndUpdate({ symbol: data.symbol }, { $set: updatedData }, { new: true });

            const allCryptoData = await Coindata.find({});

            socketData.sockets.emit("LiveDataPrice", allCryptoData);
          }
        } catch (err) {
          console.log("Error processing WebSocket message:", err);
        }
      });


      if (socketData.sockets.listenerCount("connection")) {
        // console.log(`Adding connection listener for ${symbol}`);

        socketData.sockets.on("connection", (socket) => {
          socket.on("symbol", async ({ pairName, userId }) => {
            await connectToBinance(pairName, socket, userId);
          });
        });
      }


      ws.on("close", () => {
        console.log(`WebSocket connection closed for ${symbol}, reconnecting...`);
        delete socketConnections[symbol];
        setTimeout(() => fetchPairData(socketData), 5000); // Reconnect after 5 seconds
      });

      ws.on("error", (err) => {
        console.error(`WebSocket error for ${symbol}:`, err);
      });
    });
  } catch (error) {
    console.error("Error fetching pair data:", error);
  }

  const connectToBinance = async (symbol, socket, userId) => {
    //  console.log(userId,"userId");

    try {

      const lowerSymbol = symbol.toLowerCase();

      if (activeSockets[lowerSymbol]) {
        return; // Already connected
      }

      const binanceSocketUrl = `wss://stream.binance.com:9443/ws`;
      const binanceConnection = new WebSocket(binanceSocketUrl);
      activeSockets[lowerSymbol] = binanceConnection;

      binanceConnection.on("open", () => {
        // console.log(`Connected to Binance for OrderBook ${lowerSymbol}`);
        const payload = {
          method: "SUBSCRIBE",
          params: [`${lowerSymbol}@depth20@1000ms`],
          id: 1,
        };
        binanceConnection.send(JSON.stringify(payload));
      });

      binanceConnection.on("message", async (rawData) => {
        try {
          const orderBookData = JSON.parse(rawData.toString());
          if (!orderBookData || (!orderBookData.bids && !orderBookData.asks)) return;

          // Binance Bids
          const binanceBids = orderBookData.bids.map(([price, quantity]) => {
            const total = parseFloat(price) * parseFloat(quantity);
            return {
              price: parseFloat(price),
              amount: parseFloat(quantity),
              total: parseFloat(total.toFixed(4)),
              userId: null
            };
          });

          // Binance Asks
          const binanceAsks = orderBookData.asks.map(([price, quantity]) => {
            const total = parseFloat(price) * parseFloat(quantity);
            return {
              price: parseFloat(price),
              amount: parseFloat(quantity),
              total: parseFloat(total.toFixed(4)),
              userId: null
            };
          });

          // DB Orders
          const [dbBids, dbAsks] = await Promise.all([
            TradeOrderHistory.find({
              type: "buy",
              pairName: symbol,
              status: { $in: ["active", "pending", "partially"] }
            }),
            TradeOrderHistory.find({
              type: "sell",
              pairName: symbol,
              status: { $in: ["active", "pending", "partially"] }
            })
          ]);

          // Format DB Orders
          const dbFormattedBids = dbBids.map(order => {
            const total = parseFloat(order.price) * parseFloat(order.pendingAmnt);
            return {
              price: parseFloat(order.price),
              amount: parseFloat(order.pendingAmnt),
              total: parseFloat(total.toFixed(4)),
              userId: order.userId?.toString() || null
            };
          });

          const dbFormattedAsks = dbAsks.map(order => {
            const total = parseFloat(order.price) * parseFloat(order.pendingAmnt);
            return {
              price: parseFloat(order.price),
              amount: parseFloat(order.pendingAmnt),
              total: parseFloat(total.toFixed(4)),
              userId: order.userId?.toString() || null
            };
          });

          // Merge function by price
          const mergeOrders = (binanceOrders, dbOrders, isBid = true) => {
            const mergedMap = new Map();

            // Add Binance orders first
            binanceOrders.forEach(order => {
              mergedMap.set(order.price, { ...order }); // userId: null
            });

            // Merge DB orders
            dbOrders.forEach(order => {
              const existing = mergedMap.get(order.price);
              if (existing) {
                existing.amount += order.amount;
                existing.total = parseFloat((existing.price * existing.amount).toFixed(4));
                if (order.userId) {
                  existing.userId = order.userId;
                }
              } else {
                mergedMap.set(order.price, { ...order });
              }
            });

            // Convert to array and sort
            const mergedArray = Array.from(mergedMap.values());
            return mergedArray.sort((a, b) =>
              isBid ? b.price - a.price : a.price - b.price
            );
          };

          const mergedBids = mergeOrders(binanceBids, dbFormattedBids, true);
          const mergedAsks = mergeOrders(binanceAsks, dbFormattedAsks, false);

          const orderBookUpdate = {
            symbol,
            bids: mergedBids,
            asks: mergedAsks,
          };
          // console.log("orderBookUpdate", orderBookUpdate);

          socketData.sockets.emit("orderBookUpdate", orderBookUpdate);
        } catch (error) {
          console.error("Error processing WebSocket message:", error);
        }
      });

      binanceConnection.on("error", (error) => {
        console.error(`Binance WebSocket error for ${symbol}:`, error);
      });

      binanceConnection.on("close", () => {
        // console.log(`WebSocket closed for ${symbol}. Reconnecting...`);
        setTimeout(() => connectToBinance(symbol, socket), 5000);
      });
    } catch (error) {
      console.error("Error connecting to Binance WebSocket:", error);
    }
  };

}


const createOrder = async (data, socket) => {
  // console.log("data--", data);  

  try {
    const { type, orderType, pair, price, amount, userId } = data;

    if (orderType === "market") {

      const matchQuery = {
        pairName: pair,
        orderType: "limit",
        type: type === "buy" ? "sell" : "buy",
        status: { $in: ["active", "partially", "pending"] }
      };
      // console.log(matchQuery, "matchquery");

      const sortOrder = type === "buy" ? { price: 1, _id: 1 } : { price: -1, _id: 1 };
      const matchingOrders = await Order.find(matchQuery).sort(sortOrder);

      // console.log(matchingOrders, "matchingOrders");

      if (matchingOrders.length === 0) {
        return socket.emit("tradeError", { status: 0, msg: ` There is no active ${type == "sell" ? "Buy" : "Sell"} Orders` });
      };
    }


    if (pair == "" || type == "" || orderType == "" || amount <= 0 || userId == "" || price <= 0) {
      // console.error("Fields Are Require!");
      return socket.emit("tradeError", { status: 0, msg: "All fields are required." });
    }

    const validOrderTypes = ["market", "limit"];
    const validTypes = ["buy", "sell"];

    if (!validOrderTypes.includes(String(orderType).toLowerCase()) || !validTypes.includes(String(type).toLowerCase())) {
      return socket.emit("tradeError", {
        status: 0,
        msg: "Invalid order type or type. Order type must be 'market' or 'limit'. Type must be 'buy' or 'sell'.",
      });
    };

    // Fetch market data
    const liveData = await Coindata.findOne({ symbol: pair });
    if (!liveData) {
      return socket.emit("tradeError", { status: 0, msg: "Market data not found for the given pair." });
    }

    const marketPrice = parseFloat(liveData.current_price);

    const findUsdPrice = await pairData.findOne({ symbol: "USDT" })
    const usdPrice = findUsdPrice?.current_price
    const userBalance = await updateBalance.findOne({ userId })
    const baseCurrency = pair == "ADAUSDT" ? "CARDONA" : pair.substring(0, 3);
    const balanceKey = `${baseCurrency}_Balance`;
    const beforePairBal = userBalance[balanceKey] ?? 0;

    const actualUsdPrice = orderType === "market" ? usdPrice * price : usdPrice * price;
    const totalUsdPrice = orderType === "market" ? usdPrice * price * amount : usdPrice * price * amount;


    const total = amount * price;
    const accuratetotal = cleanFloat(total);

    // Prepare order data
    let orderData = {
      pair: liveData._id,
      pairName: liveData.symbol,
      type: type.toLowerCase(),
      orderType: orderType.toLowerCase(),
      amount: parseFloat(amount),
      // filledAmount: parseFloat(amount),
      pendingAmnt: parseFloat(amount),
      usdPrice: actualUsdPrice,
      totalUsdPrice: totalUsdPrice,
      beforeUsdtBal: userBalance.USDT_Balance || 0,
      beforePairBal: beforePairBal,
      userId,
      status: "active",
      dateTime: new Date(),
      total: 0,
      referenceId: new mongoose.Types.ObjectId(),
    };

    // Market Order
    if (orderType === "market") {
      orderData.price = price;
      orderData.total = orderData.amount * price;
      if ((type === "buy" && price) || (type === "sell" && price)) {
        orderData.status = "active";
        orderData.executedAt = new Date();
      }
    }

    // Limit Order
    else if (orderType === "limit") {
      if (!price || price <= 0) {
        return socket.emit("tradeError", { status: 0, msg: "Limit price must be greater than zero for limit orders." });
      }

      orderData.price = parseFloat(price);

      orderData.total = accuratetotal;

      if ((type === "buy" && marketPrice <= price) || (type === "sell" && marketPrice >= price)) {
        orderData.status = "active";
        orderData.executedAt = new Date();
      }
    }


    const pairSymbol = type == "buy" ? liveData.symbol.substring(3, 7) : liveData.symbol.substring(0, 3)
    const pairAmnt = type == "buy" ? parseFloat(amount) * price : parseFloat(amount)

    if (orderType === "limit") {
      await userUpdateBalance(userId, pairSymbol, pairAmnt, "sub")
    } const newOrder = await Order.create(orderData);

    const queue = orderQueue(newOrder.pair);

    const job = await queue.add('match-order', {
      order: newOrder,
      userId,
    }, {
      removeOnComplete: true,
      removeOnFail: false,
    })
      .then(() => {
        startWorker(newOrder.pair, socket);
      })
      .catch((err) => {
        console.error({ err });
      });


    socket.emit("tradeSuccess", {
      status: 1,
      msg: `${type.charAt(0).toUpperCase() + type.slice(1)} ${orderType} order ${orderData.status === "active" ? "Submitted" : "placed"} Successfully.`,
      orderData: newOrder,
    });

    socket.emit("tradeSuccessApp", {
      status: 1,
      msg: `${type.charAt(0).toUpperCase() + type.slice(1)} ${orderType} order ${orderData.status === "active" ? "Submitted" : "placed"} Successfully.`,
      orderData: newOrder,
    });


    socket.emit("orderBookUpdate", { order: newOrder });

  } catch (error) {
    console.error("Error in createTrade socket event:", error);
    socket.emit("tradeError", { status: 0, msg: "An error occurred while creating the order." });
  }
};
//socket process
const cancelOrder = async (data, socket) => {
  try {
    const orderDoc = await Order.findById({ _id: data._id });
    if (!orderDoc) {
      return socket.emit("orderCancelled", { status: false, message: "Order not found" });
    }

    const pair = orderDoc.pair;  // ID from DB
    const queue = orderQueue(pair);

    await queue.add("cancel-order", {
      data, // entire input data
    }, {
      removeOnComplete: true,
      removeOnFail: false,
    });

    startWorker(pair, socket); // ensure worker is started

  } catch (error) {
    console.error("Error queueing cancel order:", error);
    socket.emit("orderCancelled", { status: false, message: "Failed to queue cancel order" });
  }
};

const cancelOrder1 = async (req, res) => {
  try {
    const data = req.body;
    const orderDoc = await Order.findById({ _id: data._id });

    if (!orderDoc) {
      return res.send({ status: false, message: "Order not found" });
    }

    const pair = orderDoc.pair;

    startWorker1(pair);

    const queue = orderQueue1(pair);
    const job = await queue.add("cancel-order", { data }, {
      removeOnComplete: true,
      removeOnFail: false
    });

    const events = getQueueEvents(pair);
    const response = await job.waitUntilFinished(events);

    res.send(response);
  } catch (error) {
    console.error("Error queueing cancel order:", error);
    res.status(500).send({ status: false, message: "Failed to queue cancel order" });
  }
};


module.exports = {
  Coincreate,
  fetchPairData,
  SocketInit,
  createOrder,
  cancelOrder,
  cancelOrder1,
}