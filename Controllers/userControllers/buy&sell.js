const axios = require("axios");
const config = require("../../Config/config");
const fiatOrderHistory = require("../../Modules/userModule/fiatOrderHistory");
const pendingRequestsMap = new Map();

const fiatcurrencies = async (req, res) => {

  try {
    const response = await axios.get(
      `${config.TransakAPIURL}/api/v2/currencies/fiat-currencies`,
      {
        headers: {
          accept: "application/json",
          "api-key": config.TransakAPI,
        },
      }
    );

    const currencies = Array.isArray(response?.data.response) ? response.data.response : [];
    console.log("currencies==+", currencies.length);

    res.json(currencies);


    // if (Array.isArray(response.data.response)) {
    //   res.json(response.data.response);
    // } else {
    //   res.json([]);
    // }
  } catch (error) {
    console.error(
      "Error fetching fiat currencies:",
      error.response?.data || error.message
    );
    res.status(error.response?.status || 500).json({
      message: "Error fetching fiat currencies",
      error: error.response?.data || error.message,
    });
  }
};

const cryptocurrencies = async (req, res) => {
  try {
    const response = await axios.get(
      `${config.TransakAPIURL}/api/v2/currencies/crypto-currencies`,
      {
        headers: {
          accept: "application/json",
          "api-key": config.TransakAPI,
        },
      }
    );
    const allowedCurrencies = ["BTC", "ETH", "SOL", "LTC", "ADA", "USDT"];

    const cryptoList = response.data?.response || [];

    const filteredData = cryptoList.filter((crypto) =>
      allowedCurrencies.includes(crypto.symbol)
    );

    res.json(filteredData);
  } catch (error) {
    res.status(error.response?.status || 500).json({
      message: "Error fetching crypto currencies",
      error: error.response?.data || error.message,
    });
  }
};

const getOrder = async (req, res) => {
  try {
    // Get access token from refresh-token API
    const tokenResponse = await axios.post(
      `${config.TransakAPIURL}/partners/api/v2/refresh-token`,
      {
        apiKey: config.TransakAPI, // Pass your API Key dynamically
      },
      {
        headers: {
          accept: "application/json",
          "api-secret": config.TransakSecret, // Pass your API Secret
          "content-type": "application/json",
        },
      }
    );

    const accessToken = tokenResponse.data.data.accessToken;

    // Now use the access token to fetch order details
    const response = await axios.get(
      `${config.TransakAPIURL}/partners/api/v2/order/e3687a77-5cb5-4023-8b4b-7a7ef87ed61c`, // Pass order ID dynamically
      {
        headers: {
          accept: "application/json",
          "access-token": accessToken, // ✅ Pass the new token here
        },
      }
    );

    res.json(response.data.response); // Return order details to client
  } catch (error) {
    console.error("Error:", error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      message: "Error fetching order details",
      error: error.response?.data || error.message,
    });
  }
};


const orderIdHistory = async(req, res) => {
  try{
  const userId = res.locals.user_id;
  const { orderId } = req.body;
  const key = `${userId}:${orderId}`;

  if (pendingRequestsMap.has(key)) {
    clearTimeout(pendingRequestsMap.get(key).timeout);
  }

  const timeout = setTimeout(async() => {
    await handleLatestOrderIdHistory(pendingRequestsMap.get(key).req, pendingRequestsMap.get(key).res);
    pendingRequestsMap.delete(key); 
  }, 5000);


  pendingRequestsMap.set(key, { timeout, req, res });
}catch(error){
  console.log(error);
}
};

const handleLatestOrderIdHistory = async (req, res) => {
  try {
    const userId = res.locals.user_id;
    const { orderId } = req.body;

    const tokenResponse = await axios.post(
      `${config.TransakAPIURL}/partners/api/v2/refresh-token`,
      { apiKey: config.TransakAPI },
      {
        headers: {
          accept: "application/json",
          "api-secret": config.TransakSecret,
          "content-type": "application/json",
        },
      }
    );

    const accessToken = tokenResponse.data.data.accessToken;

    let transakOrder;
    try {
      const orderResponse = await axios.get(
        `${config.TransakAPIURL}/partners/api/v2/order/${orderId}`,
        {
          headers: {
            accept: "application/json",
            "access-token": accessToken,
          },
        }
      );
      transakOrder = orderResponse.data.data;
    } catch (err) {
      console.log(err)
      if (err.response?.status === 400 && err.response.data?.message === "Order not found") {
        return res.status(404).send({
          status: false,
          message: "Order not found or may have been cancelled.",
        });
      }
    }

    if (!transakOrder || !transakOrder._id) {
      return res.send({ status: false, message: "Invalid order data" });
    }

    const existingOrder = await fiatOrderHistory.findOne({ orderId: transakOrder._id });

    if (existingOrder) {
      if (existingOrder.status !== transakOrder.status) {
        existingOrder.status = transakOrder.status;
        existingOrder.completedAt = transakOrder?.completedAt || transakOrder?.updatedAt ;
        existingOrder.transactionHash = transakOrder.transactionHash;
        existingOrder.transactionLink = transakOrder.transactionLink;
        await existingOrder.save();

        return res.send({
          status: true,
          message: `Order status updated to '${transakOrder.status}`,
        });
      } else {
        return res.send({
          status: false,
          message: `Order status '${transakOrder.status}' already saved`,
        });
      }
    }

    const createOrder = new fiatOrderHistory({
      userId,
      orderId: transakOrder._id,
      fiatCurrency: transakOrder.fiatCurrency,
      cryptoCurrency: transakOrder.cryptoCurrency,
      isBuyOrSell: transakOrder.isBuyOrSell,
      fiatAmount: transakOrder.fiatAmount,
      amountPaid: transakOrder.amountPaid,
      paymentOptionId: transakOrder.paymentOptionId,
      network: transakOrder.network,
      cryptoAmount: transakOrder.cryptoAmount,
      conversionPrice: transakOrder.conversionPrice,
      totalFeeInFiat: transakOrder.totalFeeInFiat,
      walletAddress: transakOrder.walletAddress,
      fromWalletAddress: transakOrder.fromWalletAddress,
      completedAt: transakOrder.createdAt,
      transactionHash: transakOrder.transactionHash,
      transactionLink: transakOrder.transactionLink,
      status: transakOrder.status,
      ipAddress: transakOrder.ipAddress,
    });

    await createOrder.save();

    res.send({
      status: true,
      message: `Order status '${transakOrder.status}' saved successfully`,
    });

  } catch (error) {
    console.error("Error in orderIdHistory:", error);
    res.status(500).send({ status: false, message: "Internal Server Error" });
  }
};

const updateOrderIdHistory = async (userId,orderId) => {
  try {

    const tokenResponse = await axios.post(
      `${config.TransakAPIURL}/partners/api/v2/refresh-token`,
      { apiKey: config.TransakAPI },
      {
        headers: {
          accept: "application/json",
          "api-secret": config.TransakSecret,
          "content-type": "application/json",
        },
      }
    );

    const accessToken = tokenResponse.data.data.accessToken;

    let transakOrder;
    try {
      const orderResponse = await axios.get(
        `${config.TransakAPIURL}/partners/api/v2/order/${orderId}`,
        {
          headers: {
            accept: "application/json",
            "access-token": accessToken,
          },
        }
      );
      transakOrder = orderResponse.data.data;
    } catch (err) {
      if (err.response?.status === 400 && err.response.data?.message === "Order not found") {
        console.log("Order not found or may have been cancelled.");
      }
    }

    if (!transakOrder || !transakOrder._id) {
      return 
    }

    const existingOrder = await fiatOrderHistory.findOneAndUpdate({ orderId: transakOrder._id },{$set:{
      status : transakOrder.status,
      completedAt: transakOrder?.completedAt || transakOrder?.updatedAt,
      transactionHash: transakOrder.transactionHash,
      transactionLink: transakOrder.transactionLink
    }}, { new: true });
    if (existingOrder) {
      console.log(`Order status updated to '${transakOrder.status}''${transakOrder._id}`);
      return;
    }
  } catch (error) {
    console.error("Error in orderIdHistory:", error);
  }
};





module.exports = {
  fiatcurrencies,
  cryptocurrencies,
  getOrder,
  orderIdHistory,
  updateOrderIdHistory
};
