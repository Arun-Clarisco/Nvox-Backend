const CryptoJS = require("crypto-js");
const userModule = require("../../Modules/userModule/userModule");
const kycUserData = require("../../Modules/userModule/KycVerification");
const userIndiviuals = require("../../Modules/userModule/IndividualUserForm");
const bussinessUser = require("../../Modules/userModule/BussinesUserForm");
const DepositData = require("../../Modules/userModule/Transaction");
const WithdrawData = require("../../Modules/userModule/Withdrawhistory");
const axios = require("axios");
const TradeOrderHistory = require("../../Modules/userModule/tradeOrder");
const MappingOrders = require("../../Modules/userModule/MappingOrders");
const config = require("../../Config/config");
const jwt = require("jsonwebtoken");
const userBalance = require("../../Modules/userModule/userBalance");
const userSwapHistory = require("../../Modules/userModule/Userswapshistory");
const FiatOrderData = require("../../Modules/userModule/fiatOrderHistory");
const pairData = require("../../Modules/userModule/pairData");
const userWithdrawHistory = require("../../Modules/userModule/Withdrawhistory");
const SwapHistory = require("../../Modules/userModule/Userswapshistory");
const coinfee = require("../../Modules/adminModule/Coinfeesetting");
const TotalAmountchart = require("../../Modules/userModule/userTotalAsset");
const TotalDepositwithdraw = require("../../Modules/userModule/Transaction");
const TermSchema = require("../../Modules/adminModule/TermsConditionsData");
const SignUpVerifyPhone = require("../../Modules/userModule/PhoneVerification");

const mongoose = require("mongoose");
const { updateOrderIdHistory } = require("./buy&sell");
const ObjectId = mongoose.Types.ObjectId;

class getMethods {

  userGetData = async (req, res) => {
    const id = res.locals.user_id;

    try {
      const resp = await userModule.findById(id);

      if (!resp) {
        return res.send({ status: false, message: "User not found" });
      }

      return res.send({
        status: true,
        message: "Get the User Data",
        resp,
      });

    } catch (error) {
      console.error("userGetData error:", error);
      return res.send({
        status: false,
        message: "Something Went Wrong..",
      });
    }
  };

  kycGetData = async (req, res) => {
    const id = res.locals.user_id;

    try {
      const resp = await kycUserData.findOne({ user_id: id });

      if (!resp) {
        return res.send({ status: false, message: "KYC Data not found" });
      }

      res.send({ status: true, message: "Get the KYC Data", resp });
    } catch (error) {
      console.error(error);
      res.send({ status: false, message: "Something went wrong" });
    }
  };


  getPhoneData = async (req, res) => {
    const { email } = req.query;

    if (!email) {
      return res.send({ status: false, message: "Email is required", resp: [] });
    }

    try {
      const resp = await SignUpVerifyPhone.findOne({ user_email: email });

      if (!resp) {
        return res.send({ status: false, message: "Phone data not found", resp: [] });
      }

      res.send({ status: true, message: "Get the phone data", resp });
    } catch (error) {
      console.error(error);
      res.send({ status: false, message: "Something went wrong" });
    }
  };

  // individual data
  // IndivGetData = async (req, res) => {
  //   const id = res.locals.user_id;
  //   console.log("individual id---",id);


  //   if (!id) {
  //     res.send({ status: false, message: "Id not found", resp: [] });
  //   }
  //   try {

  //     const resp = await userIndiviuals.findOne({ user_id: id });
  //     console.log("resp---",resp);

  //     if (!resp) {
  //       res.send({ status: false, message: "Id not found", resp: [] });
  //     }

  //     res.send({ status: true, message: "Individual Data", resp });

  //   } catch (error) {
  //     res.send({ status: false, message: "Something Went Wrong.." });
  //   }
  // };

  IndivGetData = async (req, res) => {
    const id = res.locals.user_id;
    console.log("individual id---", id);

    if (!id) {
      return res.send({
        status: false,
        message: "Id not found",
        resp: []
      });
    }

    try {
      const resp = await userIndiviuals.findOne({ user_id: id });
      // console.log("resp---", resp);

      if (!resp) {
        return res.send({
          status: false,
          message: "Individual not found",
          resp: []
        });
      }

      return res.send({
        status: true,
        message: "Individual Data",
        resp
      });

    } catch (error) {
      console.error("Error:", error);

      return res.send({
        status: false,
        message: "Something went wrong"
      });
    }
  };

  userOnboarding = async (req, res) => {
    const id = res.locals.user_id;

    try {
      const businessdata = await bussinessUser.findOne({ user_id: id });
      const indivData = await userIndiviuals.findOne({ user_id: id });

      const kycData = await kycUserData.findOne({ user_id: id });
      if (!indivData && !kycData) {
        await userModule
          .findOne({ _id: id })
          .then((userData) => {
            res.send({ status: true, data: userData });
          })
          .catch((error) => {
            res.send({ status: false, message: "Something Went Wrong.." });
          });
        return;
      } else if (!indivData) {
        await kycUserData
          .findOne(
            { user_id: id },
            {
              kyc_Status: 1,
              sdk_verification: 1,
            }
          )
          .then((userData) => {
            res.send({ status: true, data: userData });
          })
          .catch((error) => {
            res.send({ status: false, message: "Something Went Wrong.." });
          });
        return;
      }

      const userData = await kycUserData.aggregate([
        {
          $match: { user_id: id },
        },
        {
          $lookup: {
            from: "users_individuals",
            localField: "user_id",
            foreignField: "user_id",
            as: "individualData",
          },
        },
        {
          $unwind: "$individualData",
        },
        {
          $project: {
            kyc_Status: 1,
            sdk_verification: 1,
            individualData: {
              individualStatus: 1,
            },
          },
        },
      ]);

      if (!userData || userData.length === 0) {
        return res.send({
          status: false,
          message: "No data found",
          data: indivData,
          kycData,
        });
      }

      res.send({ status: true, data: userData[0], businessdata });
    } catch (error) {
      res.send({ status: false, message: "Something Went Wrong.." });
    }
  };

  userDetail = async (req, res) => {
    const id = res.locals.user_id;
    try {
      const userProfile = await userModule.aggregate([
        { $match: { _id: id } },
        {
          $lookup: {
            from: "kyc_verifications",
            localField: "_id",
            foreignField: "user_id",
            as: "kycData",
          },
        },
        { $unwind: { path: "$kycData" } },
        {
          $lookup: {
            from: "users_individuals",
            localField: "_id",
            foreignField: "user_id",
            as: "userDatas",
          },
        },
        { $unwind: { path: "$userDatas" } },
      ]);
      if (!userProfile || userProfile.length === 0) {
        return res.send({ status: false, message: "Cannot Get the User Data" });
      }
      res.send({ status: true, userProfile });
    } catch (error) {
      res.send({ status: false, message: "Something Went Wrong..", error });
    }
  };

  userDepositHistory = async (req, res) => {
    const id = res.locals.user_id;

    const { page = 1, limit = 10, search = "", symbol } = req.query;
    try {
      if (!id) {
        return res
          .status(400)
          .json({ status: false, message: "Invalid User Login..." });
      }

      const pageNumber = parseInt(page);
      const limitNumber = parseInt(limit);
      const skip = (pageNumber - 1) * limitNumber;

      const searchFilter = {
        userId: id,
        ...(symbol && { moveCur: symbol }),
        $or: [
          { txnId: { $regex: search, $options: "i" } },
          { toaddress: { $regex: search, $options: "i" } },
        ],
      };

      const totalRecords = await DepositData.countDocuments(searchFilter);
      const depositData = await DepositData.find(searchFilter)
        .sort({ _id: -1 })
        .skip(skip)
        .limit(limitNumber);

      const Depositdata = await DepositData.find(searchFilter)
        .sort({ _id: -1 })
        .limit(5);

      res.json({
        status: true,
        message: "User Deposit GetData",
        currentPage: pageNumber,
        totalPages: Math.ceil(totalRecords / limitNumber),
        totalRecords,
        data: depositData,
        Data: Depositdata,
      });
    } catch (error) {
      console.log("err", error.message);

      res
        .status(500)
        .json({ status: false, message: "Something Went Wrong.." });
    }
  };

  userWithdrawHistory = async (req, res) => {
    const id = res.locals.user_id;
    const { page = 1, limit = 10, search = "", symbol } = req.query;
    try {
      if (!id) {
        return res
          .status(400)
          .json({ status: false, message: "Invalid User Login..." });
      }

      const pageNumber = parseInt(page);
      const limitNumber = parseInt(limit);
      const skip = (pageNumber - 1) * limitNumber;

      const searchFilter = {
        userId: id,
        ...(symbol && { moveCur: symbol }),
        $or: [
          { txnId: { $regex: search, $options: "i" } },
          { moveCur: { $regex: search, $options: "i" } },
        ],
      };

      const totalRecords = await WithdrawData.countDocuments(searchFilter);
      const Withdrawhistory = await WithdrawData.find(searchFilter)
        .sort({ _id: -1 })
        .skip(skip)
        .limit(limitNumber);

      const withdrawhistory = await WithdrawData.find(searchFilter)
        .sort({ _id: -1 })
        .limit(5);

      res.json({
        status: true,
        message: "User Withdraw GetData",
        currentPage: pageNumber,
        totalPages: Math.ceil(totalRecords / limitNumber),
        totalRecords,
        data: Withdrawhistory,
        Data: withdrawhistory,
      });
    } catch (error) {
      res
        .status(500)
        .json({ status: false, message: "Something Went Wrong.." });
    }
  };

  getUserProfile = async (req, res) => {
    const id = res.locals.user_id;

    try {
      const userProfile = await userModule.aggregate([
        {
          $match: { _id: new mongoose.Types.ObjectId(id) },
        },

        {
          $lookup: {
            from: "kyc_verifications",
            localField: "_id",
            foreignField: "user_id",
            as: "getProfileData",
          },
        },
        {
          $unwind: {
            path: "$getProfileData",
          },
        },
        {
          $unwind: {
            path: "$getProfileData.birth_information",
          },
        },
        // {
        //   $unwind: {
        //     path: "$getProfileData.phone_number",
        //   },
        // },  
        // preserveNullAndEmptyArrays means phone number empty also get the data
        { $unwind: { path: "$getProfileData.phone_number", preserveNullAndEmptyArrays: true } },
        {
          $project: {
            first_name: 1,
            last_name: 1,
            email: 1,
            referral_id: 1,
            profile: 1,
            "getProfileData.birth_information.birthday": 1,
            "getProfileData.birth_information.gender": 1,
            "getProfileData.phone_number.number": 1,
            "getProfileData.phone_number.country": 1,
            "getProfileData.phone_number.country_code": 1,
            "getProfileData.current_Address.address_1": 1,
            "getProfileData.current_Address.address_2": 1,
            "getProfileData.current_Address.resident_country": 1,
            "getProfileData.current_Address.state": 1,
            "getProfileData.current_Address.city": 1,
            "getProfileData.current_Address.zip_code": 1,
          },
        },
      ]);

      if (userProfile) {
        res.send({ status: true, userProfile });
      } else {
        return res.send({ status: false, message: "No data found" });
      }
    } catch (error) {
      res.send({ status: false, message: "Something Went Wrong.." });
    }
  };


  TradeOrderHistory = async (req, res) => {
    try {
      const id = res.locals.user_id;
      await TradeOrderHistory.find({
        userId: id,
        status: { $in: ["filled", "partially", "cancelled"] },
      })
        .sort({ _id: -1 })
        .then((resp) => {
          res.send({
            status: true,
            message: "User Filled Trade Orders Retrieved",
            resp,
          });
        })
        .catch(() => {
          res.send({
            status: false,
            message: "Cannot Retrieve User Trade Orders",
          });
        });
    } catch (error) {
      res.send({ status: false, message: "Something Went Wrong.." });
    }
  };

  OpenOrderData = async (id, socket) => {
    try {
      if (id) {
        const orders = await TradeOrderHistory.find({
          userId: id,
          status: { $in: ["active", "pending", "partially"] },
        }).sort({ _id: -1 });
        const otherorders = await TradeOrderHistory.find({
          userId: { $ne: id },
          status: { $in: ["active", "pending", "partially"] },
        }).sort({ _id: -1 });

        socket.emit("OpenOrderList", {
          status: true,
          message: "Open Orders Retrieved",
          orders,
          otherorders
        });
      }
    } catch (error) {
      console.error("Error fetching open orders:", error);

      socket.emit("OpenOrderList", {
        status: false,
        message: "Something Went Wrong..",
      })
    }
  };

  recentOrder = async (data, socket) => {
    try {
      // const decoded = jwt.verify(data.token, process.env.JWT_USER_SECRET);
      const pairName = data.pairName;
      const mappingOrders = await MappingOrders.find({
        pairName,
        status: "filled",
      })
        .sort({ dateTime: -1 })
        .limit(25)
        .lean();

      const allOrderIds = mappingOrders
        .flatMap((order) => [
          order.buyOrderId?.toString(),
          order.sellOrderId?.toString(),
        ])
        .filter(Boolean);

      const tradeOrders = await TradeOrderHistory.find({
        _id: { $in: allOrderIds },
      }).lean();

      const takerTradeMap = {};
      tradeOrders.forEach((order) => {
        if (order.feeStatus === "taker") {
          takerTradeMap[order._id.toString()] = order;
        }
      });

      const enriched = mappingOrders
        .map((order) => {
          const matchBuy = takerTradeMap[order.buyOrderId?.toString()];
          const matchSell = takerTradeMap[order.sellOrderId?.toString()];

          if (matchBuy) {
            return { ...order, takerOrder: matchBuy };
          } else if (matchSell) {
            return { ...order, takerOrder: matchSell };
          } else {
            return null;
          }
        })
        .filter(Boolean);

      socket.emit("recentOrderList", {
        status: true,
        message: "Recent taker trades retrieved",
        orders: enriched,
      });

    } catch (error) {
      console.error("Error in recentOrder:", error);
      socket.emit("recentOrderList", {
        status: false,
        message: "Something went wrong while fetching recent orders",
      });
    };
  };

  userGetBalance = async (data, socket) => {
    try {
      const token = data?.token;
      if (!token) {
        return socket.emit("getBalance", {
          status: false,
          message: "Unauthorized",
        });
      }

      const decoded = jwt.verify(token, config.JWT_USER_SECRET);
      const userId = decoded.id;
      const userIdObj = new mongoose.Types.ObjectId(userId);

      let getBalance;
      try {
        getBalance = await userBalance.findOneAndUpdate(
          { userId: userIdObj },
          { $setOnInsert: { userId: userIdObj } },
          { new: true, upsert: true }
        );
      } catch (err) {
        console.error("Error in findOneAndUpdate:", err);
        if (err.code === 11000) {
          getBalance = await userBalance.findOne({ userId: userIdObj });
        } else {
          throw err;
        }
      }

      const coinFee = await coinfee.findOne({});

      // const apiData = await this.coinMarketCapApi();
      const apiData = await pairData.findOne({ symbol: "USDT" });

      socket.emit("getBalance", {
        status: true,
        message: "User Balance",
        data: { getBalance, apiData, coinFee },
      });
    } catch (error) {
      console.error("Error fetching balance:", error);
      socket.emit("getBalance", {
        status: false,
        message: "Something Went Wrong..",
      });
    }
  };

  getUserTransactionData = async (req, res) => {
    const id = res.locals.user_id;

    try {
      if (!id) {
        return res.send({ status: false, message: "Invalid User Login..." });
      }

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const result = await userWithdrawHistory.aggregate([
        {
          $match: {
            userId: id,
            status: 2,
            createdDate: { $gte: thirtyDaysAgo },
          },
        },
        {
          $group: {
            _id: null,
            totalSum: { $sum: "$TotalAmount_in_usdprice" },
          },
        },
      ]);

      const totalSum = result.length > 0 ? result[0].totalSum : 0;
      const depositResult = await DepositData.aggregate([
        {
          $match: {
            userId: id,
            createdDate: { $gte: thirtyDaysAgo },
          },
        },
        {
          $group: {
            _id: null,
            totalDeposit: { $sum: "$usdAmount" },
          },
        },
      ]);

      const depositTotalSum =
        depositResult.length > 0 ? depositResult[0].totalDeposit : 0;
      const WithdrawDatatest = await WithdrawData.find({ userId: id })
        .sort({ _id: -1 })
        .limit(2);
      const depositDatatest = await DepositData.find({ userId: id })
        .sort({ _id: -1 })
        .limit(2);

      const withdrawData = await WithdrawData.find({
        userId: id,
        status: 2,
      }).sort({ _id: -1 });

      const depositData = await DepositData.find({ userId: id }).sort({
        _id: -1,
      });

      const combined = [...withdrawData, ...depositData];

      // Sort by createdDate descending
      combined.sort(
        (a, b) => new Date(b.createdDate) - new Date(a.createdDate)
      );

      const latest4 = combined.slice(0, 4);
      const mergedData = depositDatatest.concat(WithdrawDatatest);

      if (!mergedData) {
        return res.send({ status: false, message: "No data found" });
      }

      res.send({
        status: true,
        data: latest4,
        totalWithdraw: totalSum,
        totalDeposit: depositTotalSum,
      });
    } catch (error) {
      console.log({ transactionsError: error });
      res.status(500).json({ status: false, message: "Something went wrong" });
    }
  };

  userFiatOrderHistoty = async (req, res) => {
    const id = res.locals.user_id;
    const {
      type,
      status,
      fromDate,
      toDate,
      page,
      limit = 5,
      search = "",
      transactionHash,
    } = req.query;

    try {
      if (!id) {
        return res
          .status(400)
          .json({ status: false, message: "Invalid User Login..." });
      }

      const pageNumber = parseInt(page);
      const limitNumber = parseInt(limit);
      const skip = (pageNumber - 1) * limitNumber;

      const matchQuery = {
        userId: id,
      };

      if (type) matchQuery.isBuyOrSell = type;
      if (status) matchQuery.status = status;

      if (fromDate && toDate) {
        const from = new Date(fromDate);
        const to = new Date(toDate);
        to.setHours(23, 59, 59, 999);

        matchQuery.completedAt = {
          $gte: from,
          $lte: to,
        };
      }
      if (search) {
        matchQuery.$or = [
          { transactionHash: { $regex: search, $options: "i" } },
          { orderId: { $regex: search, $options: "i" } },
          { walletAddress: { $regex: search, $options: "i" } },
        ];
      }

      const totalRecords = await FiatOrderData.countDocuments(matchQuery);
      const matchHistory = await FiatOrderData.find(matchQuery)
        .sort({ _id: -1 })
        .skip(skip)
        .limit(limitNumber);

      const History = await FiatOrderData.find({ userId: id })
        .sort({ _id: -1 })
        .limit(5);

      res.json({
        status: true,
        message: "User Fiat to Crypto History GetData",
        currentPage: pageNumber,
        totalPages: Math.ceil(totalRecords / limitNumber),
        totalRecords,
        data: matchHistory,
        Data: History,
      });
    } catch (error) {
      console.log("err", error);
      res
        .status(500)
        .json({ status: false, message: "Something Went Wrong.." });
    }
  };

  UpdateUserFiatOrderHistoty = async (req, res) => {
    const id = res.locals.user_id;
    try {
      if (!id) {
        return res
          .status(400)
          .json({ status: false, message: "Invalid User Login..." });
      }

      const getFiatOrderData = await FiatOrderData.find({
        status: { $nin: ["COMPLETED", "CANCELLED"] },
        userId: id,
      });

      for (let i = 0; i < getFiatOrderData.length; i++) {
        await updateOrderIdHistory(
          getFiatOrderData[i].userId,
          getFiatOrderData[i].orderId
        );
      }
    } catch (error) {
      console.log("err", error);
    }
  };

  userSwapHistory = async (req, res) => {
    const id = res.locals.user_id;
    const {
      page = 1,
      limit = 10,
      search = "",
      monthFilter = "allMonths",
    } = req.query;

    try {
      if (!id) {
        return res
          .status(400)
          .json({ status: false, message: "Invalid User Login..." });
      }

      const pageNumber = parseInt(page);
      const limitNumber = parseInt(limit);
      const skip = (pageNumber - 1) * limitNumber;

      let dateFilter = {};
      const today = new Date();
      const monthget = today.getMonth();

      if (monthFilter === "lastMonth") {
        const startOfLastMonth = new Date(
          today.getFullYear(),
          today.getMonth() - 1,
          1
        ); // ex: May 1
        const endOfLastMonth = new Date(
          today.getFullYear(),
          today.getMonth(),
          0,
          23,
          59,
          59,
          999
        ); // ex: May 31, 23:59:59

        dateFilter = {
          createdAt: {
            $gte: startOfLastMonth,
            $lte: endOfLastMonth,
          },
        };
      } else if (monthFilter === "lastTwoMonths") {
        const startOfTwoMonthsAgo = new Date(
          today.getFullYear(),
          today.getMonth() - 2,
          1
        );

        const endOfTwoMonthsAgo = new Date(
          today.getFullYear(),
          today.getMonth(),
          0,
          23,
          59,
          59,
          999
        );

        dateFilter = {
          createdAt: {
            $gte: startOfTwoMonthsAgo,
            $lte: endOfTwoMonthsAgo,
          },
        };
      } else if (monthFilter === "lastThreeMonths") {
        const startOfThreeMonthsAgo = new Date(
          today.getFullYear(),
          today.getMonth() - 3,
          1
        );
        const endOfThreeMonthsAgo = new Date(
          today.getFullYear(),
          today.getMonth(),
          0,
          23,
          59,
          59,
          999
        );

        dateFilter = {
          createdAt: {
            $gte: startOfThreeMonthsAgo,
            $lte: endOfThreeMonthsAgo,
          },
        };
      }

      // search filter
      //  const isNumericSearch = !isNaN(search) && search.trim() !== "";
      const searchFilter = {
        userId: id,
        ...dateFilter,
        $or: [
          { fromCoin: { $regex: search, $options: "i" } },
          { toCoin: { $regex: search, $options: "i" } },
        ],
      };

      const totalRecords = await SwapHistory.countDocuments(searchFilter);

      const Withdrawhistory = await SwapHistory.find(searchFilter).sort({
        _id: -1,
      });


      res.json({
        status: true,
        message: "User SwapHistory GetData",
        currentPage: pageNumber,
        totalPages: Math.ceil(totalRecords / limitNumber),
        totalRecords,
        data: Withdrawhistory,
      });
    } catch (error) {
      console.log("err", error);
      res
        .status(500)
        .json({ status: false, message: "Something Went Wrong.." });
    }
  };

  depositChartHistory = async (req, res) => {
    const userId = res.locals.user_id;
    try {
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      const deposits = await DepositData.aggregate([
        {
          $match: {
            userId: userId,
            createdDate: { $gte: sixMonthsAgo },
          },
        },
        {
          $group: {
            _id: {
              year: { $year: "$createdDate" },
              month: { $month: "$createdDate" },
            },
            totalUSD: { $sum: "$usdAmount" },
          },
        },
        { $sort: { "_id.year": 1, "_id.month": 1 } },
      ]);
      const formattedData = deposits.map((d) => ({
        month: new Date(d._id.year, d._id.month - 1).toLocaleString("default", {
          month: "short",
        }),
        totalUSD: d.totalUSD,
      }));

      if (formattedData.length > 0) {
        res.send({
          status: true,
          message: "User Deposit History last Six Months",
          data: formattedData,
        });
      } else {
        res.send({
          status: false,
          message: "No User Deposit History",
          data: [],
        });
      }
      // res.json(deposits);
    } catch (error) {
      res.status(500).json({ message: "Error fetching deposit history" });
    }
  };

  // Totalamountchart

  TotalamountChart = async (req, res) => {
    const id = res.locals.user_id;
    let limitOfData = 15;
    let arr = [];
    let finalData;
    try {
      if (!id) {
        return res
          .status(400)
          .json({ status: false, message: "Invalid user login" });
      }

      const userChart = await TotalAmountchart.findOne({ userId: id });

      if (userChart == null || !Array.isArray(userChart.currentDayPrice)) {
        for (let i = 0; i < limitOfData; i++) {
          arr.unshift({
            day: new Date(Date.now() - (i + 1) * 86400000).toISOString(),
            totalInUSD: 0,
          });
        }
        return res.send({
          status: true,
          message: "User total amount history (Last 16 days)",
          totalCount: 15,
          resp: arr.flat(Infinity),
        });
      }

      const today = new Date();
      const endUTC = new Date(
        Date.UTC(
          today.getUTCFullYear(),
          today.getUTCMonth(),
          today.getUTCDate(),
          23,
          59,
          59,
          999
        )
      );

      const startUTC = new Date(endUTC);
      startUTC.setUTCDate(endUTC.getUTCDate() - 15);
      startUTC.setUTCHours(0, 0, 0, 0);

      const dailyMap = new Map();

      for (const item of userChart.currentDayPrice) {
        if (!item.day) continue;

        const itemDate = new Date(item.day);
        if (itemDate >= startUTC && itemDate <= endUTC) {
          const dateKey = itemDate.toISOString().slice(0, 10);
          if (!dailyMap.has(dateKey)) {
            dailyMap.set(dateKey, {
              day: itemDate,
              totalInUSD: parseFloat(item.totalInUSD || 0),
            });
          }
        }
      }

      const sortedChart = Array.from(dailyMap.values()).sort(
        (a, b) => new Date(a.day) - new Date(b.day)
      );
      // const sortedChart = []
      if (sortedChart.length > limitOfData) {
        arr.push(sortedChart.slice(-limitOfData));
      } else if (sortedChart.length == limitOfData) {
        arr.push(sortedChart);
      } else {
        arr.push(sortedChart);
        let cal = limitOfData - sortedChart.length;
        for (let i = 0; i < cal; i++) {
          if (sortedChart.length == 0) {
            arr.unshift({
              day: new Date(Date.now() - (i + 1) * 86400000).toISOString(),
              totalInUSD: 0,
            });
          } else {
            arr.unshift({
              day: new Date(
                new Date(sortedChart[0].day).getTime() - (i + 1) * 86400000
              ).toISOString(),
              totalInUSD: 0,
            });
          }
        }
      }
      finalData = arr.flat(Infinity);
      const totalCount = finalData.length;

      return res.send({
        status: true,
        message: "User total amount history (Last 16 days)",
        totalCount: totalCount,
        resp: finalData,
      });
    } catch (error) {
      console.error("Error in TotalamountChart:", error);
      return res.send({
        status: false,
        message: "Something went wrong",
        error: error.message,
      });
    }
  };

  individualTradeOderHistory = async (req, res) => {

    try {
      const id = res.locals.user_id;
      const ID = req.query.id;
      const preresult = await TradeOrderHistory.find({
        userId: id,
        _id: new ObjectId(ID),
      });
      const orderidtype =
        preresult[0].type === "buy" ? "buyOrderId" : "sellOrderId";
      const result = await TradeOrderHistory.aggregate([
        {
          $match: { _id: new ObjectId(ID) },
        },
        {
          $lookup: {
            from: "MappingOrders",
            localField: "_id",
            foreignField: orderidtype,
            as: "matchedMappings",
          },
        },
        {
          $addFields: {
            isFilled: { $eq: ["$status", "fiilled"] },
          },
        },
        {
          $project: {
            matchedMappings: 1,
            _id: { $cond: ["$isFilled", "$$REMOVE", "$_id"] },
            userId: { $cond: ["$isFilled", "$$REMOVE", "$userId"] },
            amount: { $cond: ["$isFilled", "$$REMOVE", "$amount"] },
            filledAmount: { $cond: ["$isFilled", "$$REMOVE", "$filledAmount"] },
            pendingAmnt: { $cond: ["$isFilled", "$$REMOVE", "$pendingAmnt"] },
            price: { $cond: ["$isFilled", "$$REMOVE", "$price"] },
            usdPrice: { $cond: ["$isFilled", "$$REMOVE", "$usdPrice"] },
            totalUsdPrice: {
              $cond: ["$isFilled", "$$REMOVE", "$totalUsdPrice"],
            },
            type: { $cond: ["$isFilled", "$$REMOVE", "$type"] },
            total: { $cond: ["$isFilled", "$$REMOVE", "$total"] },
            beforeUsdtBal: {
              $cond: ["$isFilled", "$$REMOVE", "$beforeUsdtBal"],
            },
            beforePairBal: {
              $cond: ["$isFilled", "$$REMOVE", "$beforePairBal"],
            },
            creditAmount: { $cond: ["$isFilled", "$$REMOVE", "$creditAmount"] },
            fee: { $cond: ["$isFilled", "$$REMOVE", "$fee"] },
            feeStatus: { $cond: ["$isFilled", "$$REMOVE", "$feeStatus"] },
            orderType: { $cond: ["$isFilled", "$$REMOVE", "$orderType"] },
            dateTime: { $cond: ["$isFilled", "$$REMOVE", "$dateTime"] },
            pair: { $cond: ["$isFilled", "$$REMOVE", "$pair"] },
            pairName: { $cond: ["$isFilled", "$$REMOVE", "$pairName"] },
            referenceId: { $cond: ["$isFilled", "$$REMOVE", "$referenceId"] },
            isProcessed: { $cond: ["$isFilled", "$$REMOVE", "$isProcessed"] },
            updateAt: { $cond: ["$isFilled", "$$REMOVE", "$updateAt"] },
            __v: { $cond: ["$isFilled", "$$REMOVE", "$__v"] },
            status: { $cond: ["$isFilled", "$$REMOVE", "$status"] },
          },
        },
      ]);

      res.send({ status: true, data: result, message: "Successfully.." });
    } catch (error) {
      res.send({ status: false, message: "Something Went Wrong.." });
    }
  };


  usertransactionHistory = async (req, res) => {
    const id = res.locals.user_id;
    const {
      page = 1,
      limit = 10,
      search = "",
      type,
      startDate,
      endDate,
      statusfilter,
      network,
    } = req.query;

    if (!id) {
      return res
        .status(400)
        .json({ status: false, message: "Invalid User Login..." });
    }

    let Model;
    if (type === "deposit") {
      Model = DepositData;
    } else if (type === "withdraw") {
      Model = WithdrawData;
    } else {
      return res.status(400).json({
        status: false,
        message: "Invalid type. Must be 'deposit' or 'withdraw'.",
      });
    }

    try {
      const pageNumber = parseInt(page);
      const limitNumber = parseInt(limit);
      const skip = (pageNumber - 1) * limitNumber;

      const searchFilter = { userId: id };

      if (search && search.trim() !== "") {
        const searchValue = search.trim();
        const searchRegex = new RegExp(searchValue, "i");

        const orConditions = [{ txnId: searchRegex }, { moveCur: searchRegex }];

        if (type === "deposit") {
          orConditions.push({ fromAddress: searchRegex });
        } else if (type === "withdraw") {
          orConditions.push({ toaddress: searchRegex });
        }

        searchFilter.$or = orConditions;
      }

      if (network && network.trim() !== "") {
        searchFilter.moveCur = network.toUpperCase();
      }
      if (startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);

        searchFilter.createdDate = {
          $gte: start,
          $lte: end,
        };
      }

      if (
        type === "withdraw" &&
        statusfilter !== "" &&
        statusfilter !== null &&
        ["0", "1", "2"].includes(statusfilter)
      ) {
        searchFilter.status = Number(statusfilter);
      }
      const totalRecords = await Model.countDocuments(searchFilter);
      const records = await Model.find(searchFilter)
        .sort({ _id: -1 })
        .skip(skip)
        .limit(limitNumber);

      return res.json({
        status: true,
        message: `User ${type} history retrieved successfully.`,
        currentPage: pageNumber,
        totalPages: Math.ceil(totalRecords / limitNumber),
        totalRecords,
        data: records,
      });
    } catch (error) {
      console.error("❌ Server Error:", error.message);
      res.status(500).json({ status: false, message: "Something went wrong." });
    }
  };
  // ....................privacy doc data..................  
  getMobileAndWebkycdocData = async (req, res) => {
    try {
      const TermsConditionsData = await TermSchema.findOne({
        Note: "TermsConditions",
      });
      const PriceData = await TermSchema.findOne({ Note: "Price" });
      const PartnerBankData = await TermSchema.findOne({ Note: "PartnerBank" });
      const OtherConditionData = await TermSchema.findOne({
        Note: "OtherCondition",
      });
      const SpecialConditionData = await TermSchema.findOne({
        Note: "SpecialCondition",
      });
      const DataPrivacyData = await TermSchema.findOne({ Note: "DataPrivacy" });
      const DataProtectionData = await TermSchema.findOne({
        Note: "DataProtection",
      });
      return res.send({
        status: true,
        TermsConditionsData,
        PriceData,
        PartnerBankData,
        OtherConditionData,
        SpecialConditionData,
        DataPrivacyData,
        DataProtectionData,
      });
    } catch (err) {
      console.log("err", err);
      return res.status(500).json({ message: "something went wrong.." });
    }
  };

  getAccountStatus = async (req, res) => {
    try {
      const id = res.locals.user_id;
      const userData = await userModule.findOne({ _id: id });

      if (!id) {
        return res.send({ status: false, message: "Invalid User Login..." });
      }


      if (!userData) {
        return res.send({ status: false, message: "User not found" });
      }

      res.send({
        status: true,
        isActive: userData.account_status,
      });

    } catch (error) {
      console.error("Error fetching account status:", error);
      res.send({ status: false, message: "Something went wrong" });
    }
  };
}
module.exports = new getMethods();
