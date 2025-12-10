const ETH = require("../../CoinTransaction/ETH");
const BTC = require("../../CoinTransaction/BTC");
const SOL = require("../../CoinTransaction/SOL");
const LTC = require("../../CoinTransaction/LTC");
const ADA = require("../../CoinTransaction/ADA");
const withdrawHistory = require("../../Modules/userModule/Withdrawhistory");
const userBalance = require("../../Modules/userModule/userBalance");
const UserSwapHistory = require("../../Modules/userModule/Userswapshistory");
const { userUpdateBalance } = require("./userController");
const axios = require("axios");
const config = require("../../Config/config");
const pairData = require("../../Modules/userModule/pairData");
const WebSocket = require("ws");
const adminswapfee = require("../../Modules/adminModule/Adminswapfeehistroy");
const { encryptData, decryptData } = require("../../Config/Security");

const createAddress = async (req, res) => {
  try {
    const { symbol } = req.body;
    const userid = res.locals.user_id;
    // console.log("userid", userid, typeof userid) ;
    if (!userid || !symbol)
      return res.status(400).json({ error: "User ID and Symbol are required" });

    // Atomically ensure balance exists without duplication
    const baldata = await userBalance.findOneAndUpdate(
      { userId: userid },
      { $setOnInsert: { userId: userid } },
      { upsert: true }
    );
    //  console.log("Balance ensured for user:", userid, baldata);

    let newAddress;
    switch (symbol.toUpperCase()) {
      case "ETH":
        newAddress = await ETH.ETHCreateAddress(userid);
        break;
      case "BTC":
        newAddress = await BTC.BTCCreateAddress(userid);
        break;
      case "SOL":
        newAddress = await SOL.SolanaAddress(userid);
        break;
      case "LTC":
        newAddress = await LTC.LTCAddress(userid);
        break;
      case "ADA":
        newAddress = await ADA.ADACreateAddress(userid);
        break;
      default:
        return res.status(400).json({ error: "Unsupported currency" });
    }

    if (newAddress) {
      return res.send({
        status: true,
        message: `${symbol} Wallet Address Created successfully`,
        data: newAddress,
      });
    } else {
      return res.send({
        status: false,
        message: `Cannot create ${symbol} Address`,
      });
    }
  } catch (err) {
    console.error("Error creating address:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

const handleDeposit = async (req, res) => {
  try {
    const { symbol } = req.body;
    // console.log("req.body", req.body);
    const userId = res.locals.user_id;

    if (!userId || !symbol) {
      return res.status(400).json({ error: "User ID and symbol are required" });
    }

    let depositResult;

    switch (symbol.toUpperCase()) {
      case "BTC":
        depositResult = await BTC.BtcDeposit(userId, symbol);
        break;
      case "ETH":
        depositResult = await ETH.EthDeposit(userId, symbol);
        break;
      case "USDT":
        depositResult = await ETH.EthDeposit(userId, symbol);
        break;
      case "SOL":
        depositResult = await SOL.SolanaDeposit(userId, symbol);
        break;
      case "LTC":
        depositResult = await LTC.LtcDeposit(userId, symbol);
        break;
      case "ADA":
        depositResult = await ADA.ADADeposit(userId, symbol);
        break;
      default:
        return res.status(400).json({ error: "Invalid currency symbol" });
    }

    if (depositResult.success && depositResult.count > 0) {
      const responseData = {
        success: true,
        message: depositResult.message,
        depositResult,
      };
      const encryptedDepositData = encryptData(responseData);
      return res.json({ data: encryptedDepositData });
    } else {
      return res.json({
        success: false,
        message: depositResult.message || `No new ${symbol} deposits found`,
      });
    }
  } catch (error) {
    console.error("Deposit Error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

const userWithdrawRequest = async (req, res) => {
  try {
    const userid = res.locals.user_id;
    const decData = req.body.data;
    const data = await decryptData(decData);
    let Symbol;

    if (data.Symbol !== "USDT") {
      Symbol = data.Symbol + "USDT";
    } else {
      Symbol = "USDT";
    }

    if (!userid || !data) {
      return res.status(400).json({ error: "User ID and symbol are required" });
    }
    let LiveDataPrice;
    const getBinancePrice = async (Symbol) => {
      try {
        const response = await axios.get(
          `https://api.binance.com/api/v3/ticker/price?symbol=${Symbol.toUpperCase()}`
        );
        return parseFloat(response.data.price);
      } catch (error) {
        console.error("Error fetching price:", error.message);
        return null;
      }
    };
    if (Symbol !== "USDT") {
      LiveDataPrice = await getBinancePrice(Symbol);
    } else {
      const url = `https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest`;
      try {
        const response = await axios.get(url, {
          headers: { "X-CMC_PRO_API_KEY": config.CMC_Api },
          params: { symbol: "USDT", convert: "USD" },
        });
        LiveDataPrice = parseFloat(response.data.data["USDT"].quote.USD.price);
      } catch (error) {
        console.error("Error fetching USDT price:", error.message);
        LiveDataPrice = null;
      }
    }

    if (!LiveDataPrice) {
      return res.status(500).json({ error: "Failed to fetch live price." });
    }

    // console.log('data----', data)
    const symbol = `${data.Symbol.substring(0, 3)}USDT`;
    // console.log('symbol----', symbol)
    const getPairData = await pairData.findOne({
      symbol: data.Symbol == "USDT" ? "USDT" : symbol,
    });

    let finalAmount =
      data.amount - data.amount * (getPairData.withdrawFee / 100);
    let feesAmount = data.amount * (getPairData.withdrawFee / 100);

    function fixDecimal(value, decimals = 8) {
      const multiplier = Math.pow(10, decimals);
      return (Math.round(value * multiplier) / multiplier).toFixed(decimals);
    }

    // console.log('finalAmount', finalAmount)
    const reqData = new withdrawHistory({
      userId: userid,
      toaddress: data.toAddress,
      amount: finalAmount,
      fees: feesAmount,
      liveusdPrice: LiveDataPrice,
      TotalAmount_in_usdprice: (finalAmount * LiveDataPrice).toFixed(6),
      status: 1,
      moveCur: data.Symbol,
    });

    const createWithdrawReq = await reqData.save();
    if (createWithdrawReq) {
      await userUpdateBalance(
        userid,
        createWithdrawReq.moveCur,
        data.amount,
        "subtract"
      );

      const responseData = {
        status: true,
        message: "Withdraw Request created",
      };

      const encryptedDepositData = encryptData(responseData);

      res.send({ data: encryptedDepositData });
    } else {
      const responseData = {
        status: false,
        message: "Withdraw Request cannot be created",
      };

      const encryptedDepositData = encryptData(responseData);
      res.send({
        data: encryptedDepositData,
      });
    }
  } catch (error) {
    console.log("error---", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

const adminWithdrawProcess = async (req, res) => {
  try {
    const userId = res.locals.admin_id;
    const data = req.body;
    // console.log(data, "data in admin withdraw process");

    if (!userId || !data) {
      return res.status(400).json({ error: "User ID and symbol are required" });
    }
    let withdrawResult;
    switch (data.symbol) {
      case "BTC":
        withdrawResult = await BTC.BtcWithdraw(userId, data, req);
        break;
      case "ETH":
        withdrawResult = await ETH.EthWithdraw(userId, data, req);
        break;
      case "USDT":
        withdrawResult = await ETH.EthWithdraw(userId, data, req);
        break;
      case "SOL":
        withdrawResult = await SOL.SolanaWithdraw(userId, data, req);
        break;
      case "LTC":
        withdrawResult = await LTC.LtcWithdraw(userId, data, req);
        break;
      case "ADA":
        withdrawResult = await ADA.AdaWithdraw(userId, data, req);
        break;
      default:
        return res.status(400).json({ error: "Invalid currency symbol" });
    }
    // console.log("withdrawResult", withdrawResult);

    const withdrawEncryptRes = encryptData(withdrawResult);
    // console.log("withdrawEncryptRes", withdrawEncryptRes);

    if (withdrawEncryptRes) {
      res.send({
        data: withdrawEncryptRes,
        // status: withdrawEncryptRes.status,
        // message: withdrawEncryptRes.message,
      });
    } else {
      res.send({
        data: withdrawEncryptRes,
        // status: withdrawResult.status,
        // message: withdrawResult.message,
      });
    }
  } catch (error) {
    console.log("error---", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

const adminMove = async (req, res) => {
  try {
    const adminId = res.locals.admin_id;
    const symbol = req.body.symbol;
    const ip = req.body.ip;
    if (!adminId) {
      res.send({ status: false, message: "Invalid Admin Credentials..." });
    }
    let adminMove;

    switch (symbol) {
      case "BTC":
        adminMove = await BTC.Btc_adminMove(ip, adminId, symbol, req);
        // console.log("BTCadminMove", adminMove);
        break;
      case "ETH":
        adminMove = await ETH.Eth_adminMove(ip, adminId, symbol, req);
        // console.log("EthAdminMove---", adminMove);
        break;
      case "USDT":
        adminMove = await ETH.Eth_adminMove(ip, adminId, symbol, req);
        // console.log("adminMove", adminMove);
        break;
      case "SOL":
        adminMove = await SOL.Solana_adminMove(ip, adminId, symbol, req);
        break;
      case "LTC":
        adminMove = await LTC.Ltc_adminMove(ip, adminId, symbol, req);
        break;
      case "ADA":
        adminMove = await ADA.Ada_adminMove(ip, adminId, symbol, req);
        break;
      default:
        return res.status(400).json({ error: "Invalid currency symbol" });
    }
    // console.log("adminMove", adminMove);

    let adminMoveEncryptRes;
    // return
    if (Array.isArray(adminMove)) {
      const hasSuccess = adminMove.some((item) => item.status === true);
      // console.log("hasSuccess", hasSuccess);

      const finalMessage = adminMove.find((item) => item.message) || {};
      // console.log("finalMessage", finalMessage);

      //    adminMoveEncryptRes = encryptData({
      //     status: hasSuccess,
      //     message: hasSuccess ? "Admin transfer completed successfully."
      //       : finalMessage.message || "No eligible deposits to move.",
      //     console: console.log("adminMoveEncryptResafter>>>>", adminMoveEncryptRes)
      //   });
      //   return res.json(adminMoveEncryptRes);
      // }
      //console.log("adminMoveEncryptResbefore--------", adminMoveEncryptRes);

      if (hasSuccess) {
        adminMoveEncryptRes = encryptData({
          status: true,
          message: "Admin transfer completed successfully.",
        });
        // console.log("adminMoveEncryptResbefore--------", adminMoveEncryptRes);
        return res.json({ data: adminMoveEncryptRes });
      } else {
        adminMoveEncryptRes = encryptData({
          status: false,
          message: finalMessage.message || "No eligible deposits to move.",
        });

        return res.json({ data: adminMoveEncryptRes });
        //   status: false,
        //   message: finalMessage.message || "No eligible deposits to move.",
        // });
      }
    }

    // return res.json({
    //   status: adminMove?.status || false,
    //   message: adminMove?.message || "Unknown Error",
    // });
  } catch (error) {
    console.log("error", error);
    res.send({
      status: false,
      message: "Internal Error in Admin Move Process...",
    });
  }
};

const userCryptoSwap = async (req, res) => {
  const userId = res.locals.user_id;
  const data = req.body;
  // console.log("data", data.encrypted);
  let decryptedData;
  try {
    decryptedData = decryptData(data.encrypted);
    // console.log(decryptedData, "decryptedData");
  } catch (error) {
    console.error("Decryption error:", error);
    return res.status(400).json({ error: "Invalid encrypted data." });
  }
  if (!userId || !data) {
    return res
      .status(400)
      .json({ error: "User ID and swap data are required." });
  }

  const {
    fromCoin,
    toCoin,
    fromAmount,
    toAmount,
    rate,
    estimatedAmount,
    feeamount,
    feeinUSD,
    feePercent,
  } = decryptedData;
  // console.log('req.body', req.body)
  if (!fromCoin || !toCoin || !fromAmount || !toAmount || fromCoin === toCoin) {
    return res
      .status(400)
      .json({ error: "Invalid swap data. Please check your input." });
  }

  try {
    const UserBalance = await userBalance.findOne({ userId });
    if (!UserBalance) {
      return res.status(404).json({ error: "User balance not found." });
    }
    let fromBalanceField, toBalanceField;

    if (fromCoin === "USDT") {
      fromBalanceField = "USDT_Balance";
    } else if (fromCoin === "ADAUSDT") {
      fromBalanceField = "CARDONA_Balance";
    } else {
      fromBalanceField = `${fromCoin.replace("USDT", "")}_Balance`;
    }

    if (toCoin === "USDT") {
      toBalanceField = "USDT_Balance";
    } else if (toCoin === "ADAUSDT") {
      toBalanceField = "CARDONA_Balance";
    } else {
      toBalanceField = `${toCoin.replace("USDT", "")}_Balance`;
    }

    if (UserBalance[fromBalanceField] < fromAmount) {
      // console.log("UserBalance[fromBalanceField]",`Insufficient ${fromBalanceField} balance.`);
      return res.json({
        status: false,
        message: `Insufficient ${fromBalanceField}`,
      });
    }

    UserBalance[fromBalanceField] -= parseFloat(fromAmount);
    UserBalance[toBalanceField] += parseFloat(estimatedAmount);

    await UserBalance.save();

    function extractBaseSymbol(pair) {
      if (pair.length <= 4) return pair.toUpperCase();
      return pair.replace(/(USDT|ADA|LTC|BTC|ETH|SOL)$/, "");
    }

    const swapHistory = new UserSwapHistory({
      userId,
      fromCoin: extractBaseSymbol(fromCoin),
      toCoin: extractBaseSymbol(toCoin),
      receiveAmount: parseFloat(estimatedAmount),
      feeAmount: parseFloat(feeamount),
      fromAmount: parseFloat(fromAmount),
      toAmount: parseFloat(toAmount),
      rate: parseFloat(rate),
    });
    // console.log(swapHistory, "swapHistory");

    const adminswapfeeHistory = new adminswapfee({
      Userid: userId,
      Currencysymbol: toCoin,
      Amount: parseFloat(feeamount),
      AmountinUSD: parseFloat(feeinUSD),
    });
    await swapHistory.save();
    await adminswapfeeHistory.save();
    return res.json({
      status: true,
      message: "Swap completed successfully.",
      userBalance,
      // swapHistory,
    });
  } catch (error) {
    console.error("Swap error:", error);
    return res.status(500).json({ error: "Internal server error." });
  }
};

module.exports = {
  createAddress,
  handleDeposit,
  userWithdrawRequest,
  adminWithdrawProcess,
  adminMove,
  userCryptoSwap,
};
