const userModule = require("../../Modules/userModule/userModule");
const BussinesUserForm = require("../../Modules/userModule/BussinesUserForm");
const Transaction = require("../../Modules/userModule/Transaction");
const pairData = require("../../Modules/userModule/pairData");
const Withdrawhistory = require("../../Modules/userModule/Withdrawhistory");
const TradeOrderHistory = require("../../Modules/userModule/tradeOrder");
const KycVerification = require("../../Modules/userModule/KycVerification");
const Userswapshistory = require("../../Modules/userModule/Userswapshistory");
const adminHistory = require("../../Modules/adminModule/adminTransferHistory");
const CryptoAndFiat = require("../../Modules/userModule/fiatOrderHistory");
const MappingOrders = require("../../Modules/userModule/MappingOrders");
const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;
const adminUser = require("../../Modules/adminModule/AdminModule");
const { adminActivity } = require("./SubAdminController");

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
const { encryptData, decryptData } = require("../../Config/Security"); 
class AdmingetMethods {
  getuserdetails = async (req, res) => {
    const id = res.locals.admin_id;
    const {
      fromDate,
      toDate,
      page = 1,
      limitUser = 10,
      limitBusiness = 10,
      search = "",
      kyc_Status,
      individualStatus,
      account_status,
      register_Type,
      delete_Type,
    } = req.query;

    if (!id) {
      return res.send({ status: false, message: "Invalid Admin Login..." });
    }
    const pageNum = parseInt(page) || 1;
    const userLimit = parseInt(limitUser) || 10;
    const businessLimit = parseInt(limitBusiness) || 10;

    const skip = (pageNum - 1) * userLimit;
    const skipBusiness = (pageNum - 1) * businessLimit;
    try {
      const matchStage = {};
      if (fromDate && toDate) {
        const to = new Date(toDate).setHours(23, 59, 59, 999);
        matchStage.createdDate = {
          $gte: new Date(fromDate),
          $lte: new Date(to),
        };
      }
      if (account_status) matchStage.account_status = account_status;
      let safeSearch = "";
      if (search) {
        safeSearch = escapeRegex(search);
        // console.log('safeSearch :>> ', safeSearch);

        matchStage.$or = [
          { kyc_applicantID: { $regex: safeSearch, $options: "i" } },
          { email: { $regex: safeSearch, $options: "i" } },
          { first_name: { $regex: safeSearch, $options: "i" } },
          { last_name: { $regex: safeSearch, $options: "i" } },
          { referral_id: { $regex: safeSearch, $options: "i" } },
        ];
      }

      const pipeline = [
        {
          $lookup: {
            from: "kyc_verifications",
            localField: "_id",
            foreignField: "user_id",
            as: "kycData",
          },
        },
        {
          $lookup: {
            from: "users_individuals",
            localField: "_id",
            foreignField: "user_id",
            as: "individualData",
          },
        },
        {
          $addFields: {
            kyc_Status: {
              $toString: {
                $ifNull: [{ $arrayElemAt: ["$kycData.kyc_Status", 0] }, "-"],
              },
            },
            individualStatus: {
              $toInt: {
                $ifNull: [
                  { $arrayElemAt: ["$individualData.individualStatus", 0] },
                  0,
                ],
              },
            },
            kyc_applicantID: {
              $toString: {
                $ifNull: [
                  {
                    $arrayElemAt: ["$kycData.sdk_verification.applicantID", 0],
                  },
                  "--",
                ],
              },
            },
          },
        },

        {
          $match: matchStage,
        },
      ];

      // KYC status filtering logic
      if (kyc_Status !== undefined && kyc_Status !== "") {
        if (["1"].includes(kyc_Status)) {
          pipeline.push({
            $match: {
              kycData: { $ne: [] },
              kyc_Status: { $in: ["0", "1"] },
            },
          });
        } else if (kyc_Status === "2") {
          pipeline.push({
            $match: {
              kyc_Status: "2",
              "kycData.sdk_verification.sdkStatus": "completed",
            },
          });
        } else if (kyc_Status === "-") {
          pipeline.push({
            $match: {
              kycData: { $eq: [] },
            },
          });
        }
      }

      // Individual status filtering logic
      if (individualStatus !== undefined && individualStatus !== "") {
        const statusNum = Number(individualStatus);

        if (statusNum == 2) {
          pipeline.push({ $match: { individualStatus: 2 } });
        } else if (statusNum == 1) {
          // console.log('statusNum :>> ', statusNum);
          pipeline.push({ $match: { individualStatus: { $in: [0, 1] } } });
          pipeline.push({
            $match: {
              $and: [
                { individualStatus: { $in: [0, 1] } },
                { individualData: { $ne: [] } },
              ],
            },
          });
        } else if (statusNum == 4) {
          // pipeline.push({ $match: { individualStatus: { $ne: [1, 2] } } });
          pipeline.push({
            $match: {
              individualData: { $eq: [] },
            },
          });
        }
      } else {
        pipeline.push({
          $match: {
            $or: [
              { individualStatus: { $in: [0, 1, 2] } },
              { individualData: { $eq: [] } },
            ],
          },
        });
      }

      if (register_Type && ["App", "Site"].includes(register_Type)) {
        pipeline.push({ $match: { registerType: register_Type } });
      }

      if (delete_Type && ["Admin", "User"].includes(delete_Type)) {
        pipeline.push({ $match: { deletedBy: delete_Type } });
      }

      // Pagination and sorting
      const totalUsers = await userModule.aggregate([
        ...pipeline,
        { $count: "count" },
      ]);

      const userData = await userModule.aggregate([
        ...pipeline,
        { $sort: { _id: -1 } },
        { $skip: skip },
        { $limit: Number(limitUser) },
      ]);
      // console.log('userData :>> ', userData);

      const totalPages =
        totalUsers.length > 0 ? Math.ceil(totalUsers[0].count / limitUser) : 0;
      const totalItems = totalUsers.length > 0 ? totalUsers[0].count : 0;
      // Business user search (as is)
      const businessSearch = {
        $or: [
          { user_email: { $regex: safeSearch, $options: "i" } },
          { firstname: { $regex: safeSearch, $options: "i" } },
        ],
      };
      const businessData = await BussinesUserForm.find(businessSearch)
        .sort({ _id: -1 })
        .skip(skipBusiness)
        .limit(Number(limitBusiness));

      const totalBussinessUser = await BussinesUserForm.countDocuments(
        businessSearch
      );
      const totalPage = Math.ceil(totalBussinessUser / limitBusiness);
      const bussTotaItems = totalBussinessUser;
      return res.send({
        status: true,
        message: "UserDetails found",
        data: userData,
        businessData: businessData,
        totalPages,
        totalBusinessPages: totalPage,
        totalItems,
        totalBusinessItems: totalBussinessUser,
      });
    } catch (error) {
      console.error("Error retrieving UserDetails:", error);
      return res
        .status(500)
        .json({ status: false, message: "Internal server error" });
    }
  };

  adminWithdraw = async (req, res) => {
    const id = res.locals.admin_id;
    const {
      symbol,
      page = 1,
      limit = 10,
      search = "",
      fromDate,
      toDate,
    } = req.query;
    // console.log('query', page ,limit ,search); 
    
    try {
      if (!id) {
        return res.send({ status: false, message: "Invalid Admin Login..." });
      }

      let matchConditions = [{ status: 1 }];

      if (fromDate && toDate) {
        const to = new Date(toDate).setHours(23, 59, 59, 999);
        matchConditions.push({
          createdDate: {
            $gte: new Date(fromDate),
            $lte: new Date(to),
          },
        });
      }
      if (symbol) {
        matchConditions.push({ moveCur: symbol });
      }

      if (search !== "") {
        matchConditions.push({
          $or: [
            { "userData.email": { $regex: search, $options: "i" } },
            { toaddress: { $regex: search, $options: "i" } },
          ],
        });
      }

      const userData = await Withdrawhistory.aggregate([
        // {
        //     $match: {
        //         status: 1
        //     }
        // },
        {
          $lookup: {
            from: "users",
            localField: "userId",
            foreignField: "_id",
            as: "userData",
          },
        },
        {
          $unwind: "$userData",
        },
        { $match: { $and: matchConditions } },
        {
          $project: {
            userId: 1,
            from: 1,
            toaddress: 1,
            amount: 1,
            fees: 1,
            txnId: 1,
            status: 1,
            moveCur: 1,
            createdDate: 1,
            "userData.email": 1,
          },
        },
        { $sort: { _id: 1 } },
        { $skip: (page - 1) * limit },
        { $limit: Number(limit) },
      ]); 
      // console.log("userData>>>>>>>>", userData);   
      // console.log("userData>>>>>>>>", userData.length);   

      const countAggregation = await Withdrawhistory.aggregate([
        {
          $lookup: {
            from: "users",
            localField: "userId",
            foreignField: "_id",
            as: "userData",
          },
        },
        { $unwind: "$userData" },
        { $match: { $and: matchConditions } },
        { $count: "total" },
      ]);
      // console.log("countAggregation", countAggregation);

      const totalRecords =
        countAggregation.length > 0 ? countAggregation[0].total : 0;
      const totalPages = Math.ceil(totalRecords / limit);
      const totalItems = totalRecords;
      if (!userData || userData.length === 0) {
        return res.send({ status: false, message: "No data found" });
      }

      res.send({ status: true, data: userData, totalPages, totalItems });
    } catch (error) { 
      console.error("userDataerr:", error);   

      res.status(500).json({ status: false, message: "something went wrong" });
    }
  };

  getTransactionHistory = async (req, res) => {
    const id = res.locals.admin_id;
    const {
      symbol,
      type,
      fromDate,
      toDate,
      page = 1,
      limit = 10,
      search = "",
      status,
      moveStatus,
    } = req.query;
    // console.log('req.query--', req.query)
    try {
      if (!id) {
        return res.send({ status: false, message: "Invalid Admin Login..." });
      }

      let collection;
      if (type === "withdraw") {
        collection = Withdrawhistory;
      } else if (type === "deposit") {
        collection = Transaction;
      } else {
        return res.send({ status: false, message: "Invalid transaction type" });
      }

      let matchConditions = [];
      if (fromDate && toDate) {
        const to = new Date(toDate).setHours(23, 59, 59, 999);
        matchConditions.push({
          createdDate: {
            $gte: new Date(fromDate),
            $lte: new Date(to),
          },
        });
      }

      if (symbol) {
        matchConditions.push({ moveCur: symbol });
      }

      if (search !== "") {
        matchConditions.push({
          $or: [
            { "userData.email": { $regex: search, $options: "i" } },
            { txnId: { $regex: search, $options: "i" } },
          ],
        });
      }

      const pipeline = [
        {
          $lookup: {
            from: "users",
            localField: "userId",
            foreignField: "_id",
            as: "userData",
          },
        },
        { $unwind: "$userData" },
      ];

      if (matchConditions.length > 0) {
        pipeline.push({ $match: { $and: matchConditions } });
      }
      // console.log('matchConditions', matchConditions);

      if (status !== undefined && status !== "") {
        const statusNum = Number(status);
        if ([0, 1, 2].includes(statusNum)) {
          pipeline.push({ $match: { status: statusNum } });
        }
      }
      if (moveStatus !== undefined && moveStatus !== "") {
        const moveStatusNum = Number(moveStatus);
        if ([0, 1].includes(moveStatusNum)) {
          pipeline.push({ $match: { adminMoveStatus: moveStatusNum } });
        }
      }

      pipeline.push({
        $project: {
          userId: 1,
          amount: 1,
          txnId: 1,
          status: 1,
          moveCur: 1,
          fees: 1,
          createdDate: 1,
          adminMoveStatus: 1,
          "userData.email": 1,
        },
      });

      const totalUsers = await collection.aggregate([
        ...pipeline,
        { $count: "count" },
      ]);

      const userData = await collection.aggregate([
        ...pipeline,
        { $sort: { _id: -1 } },
        { $skip: (page - 1) * limit },
        { $limit: Number(limit) },
      ]);
      const totalPages =
        totalUsers.length > 0 ? Math.ceil(totalUsers[0].count / limit) : 0;
      const totalItems = totalUsers.length > 0 ? totalUsers[0].count : 0;
      if (!userData || userData.length === 0) {
        return res.send({ status: false, message: "No data found" });
      }

      res.send({ status: true, data: userData, totalPages, totalItems });
    } catch (error) {
      console.error("Error in getTransactionHistory:", error);
      res.status(500).json({ status: false, message: "Something went wrong" });
    }
  };

  adminspotpair = async (req, res) => {
    try {
      let allData = await pairData
        .find({})
        .select("name symbol tradeStatus status")
        .limit(6)
        .exec();
      res.send({ status: true, data: allData });
    } catch (err) {
      res.status(500).json({ status: false, message: "something went wrong" });
    }
  };

  adminonespotpair = async (req, res) => {
    try {
      let allData = await pairData.find({ _id: req.params.id }).exec();
      res.send({ status: true, data: allData });
    } catch (err) {
      res.status(500).json({ status: false, message: "something went wrong" });
    }
  };

  // adminupdatespotpair = async (req, res) => {
  //   try {
  //     const adminId = res.locals.admin_id;
  //     const updateadmin = await adminUser.findOne({ _id: adminId });
  //     console.log("updateadmin", updateadmin);

  //     const data = req.body;
  //     console.log("data", data);
  //     let allData = await pairData.find({ _id: data.id }).exec();
  //     console.log("allData", allData);

  //     if (allData.length > 0) {
  //       let updated = await pairData.findByIdAndUpdate(data.id, {
  //         $set: {
  //           minimumTradeTotal: data.minimumTradeTotal,
  //           makerFee: data.makerFee,
  //           takerFee: data.takerFee,
  //           withdrawFee: data.withdrawFee,
  //           swapFee: data.swapFee,
  //           withdrawMinimumAmount: data.MinimumAmount,
  //         },
  //       });
  //       console.log("updated", updated);
  //       // const pairAdminId = await pairData.find({ _id: data.id }).exec();
  //       //       console.log("pairAdminId", pairAdminId); 

  //       if (updateadmin.admin_type == "SuperAdmin") {
  //         const pairUpdateadminActivity = await adminActivity(
  //           req,
  //           "Pair Updated",
  //           updateadmin.email,
  //           updateadmin.admin_type,
  //           updated.symbol,
  //           `${updated.symbol} Pair Updated Successfully`
  //         );
  //       } else {
  //         const pairUpdateadminActivity = await adminActivity(
  //           req,
  //           "Pair Updated",
  //           updateadmin.email,  
  //           updateadmin.adminName,
  //           updated.symbol,
  //           `${updated.symbol} Pair Updated Successfully`
  //         );
  //       }

  //       //console.log("pairUpdateadminActivity", pairUpdateadminActivity);

  //       if (updated._id) { 
  //          const pairencryptedResponse = encryptData({
  //             status: true,
  //             message: "Pair updated!!",
  //           });
  //         return res.send({ status: true, data:  pairencryptedResponse });
  //       } else {
  //         return res.send({ status: true, data: "Pair not updated!" });
  //       }
  //     } else {
  //       return res.send({ status: false, data: "No Data!" });
  //     }
  //   } catch (err) {
  //     console.log("err", err);
  //     return res
  //       .status(500)
  //       .json({ status: false, message: "something went wrong" });
  //   }
  // };



  adminupdatespotpair = async (req, res) => {
  try {
    const adminId = res.locals.admin_id;
    const updateadmin = await adminUser.findOne({ _id: adminId });
    // console.log("updateadmin", updateadmin);

    const data = req.body;
    // console.log("data", data);

    let oldData = await pairData.findById(data.id).lean();
    // console.log("oldData", oldData); 
    let updated = await pairData.findByIdAndUpdate(
      data.id,
      {
        $set: {
          minimumTradeTotal: data.minimumTradeTotal,
          makerFee: data.makerFee,
          takerFee: data.takerFee,
          withdrawFee: data.withdrawFee,
          swapFee: data.swapFee,
          withdrawMinimumAmount: data.MinimumAmount,
        },
      },
      { new: true } 
    );
    // console.log("updated", updated);

    let changes = [];
    const fields = [
      "minimumTradeTotal",
      "makerFee",
      "takerFee",
      "withdrawFee",
      "swapFee",
      "withdrawMinimumAmount",
    ];

    fields.forEach((field) => { 
      // console.log("field---", field); 
       
      let oldValue = oldData[field]; 
      //console.log("oldValue---", oldValue); 

      let newValue =
        field === "withdrawMinimumAmount" ? data.MinimumAmount : data[field];
      //  console.log("newValue---", newValue); 
      if (oldValue != newValue) {
        changes.push(`${field} `); 
      }
    });

    let changeMsg =
      changes.length > 0 
        ? `Changes: ${changes.join(", ")}`
        : "No fields updated"; 
      //console.log("changeMsg", changeMsg);
    // Final log message
    let activityMsg = `${updated.symbol} Pair Updated Successfully – ${changeMsg}`;

    if (updateadmin.admin_type == "SuperAdmin") {
      await adminActivity(
        req,
        data.ip,
        "Pair Updated",
        updateadmin.email,
        updateadmin.admin_type,
        updated.symbol,
        activityMsg
      );
    } else {
      await adminActivity(
        req,
        data.ip,
        "Pair Updated",
        updateadmin.email,
        updateadmin.adminName,
        updated.symbol,
        activityMsg
      );
    }

    if (updated._id) {
      const pairencryptedResponse = encryptData({
        status: true,
        message: "Pair updated!!",
      });
      return res.send({ status: true, data: pairencryptedResponse });
    } else {
      return res.send({ status: false, data: "Pair not updated!" });
    }
  } catch (err) {
    console.log("err", err);
    return res
      .status(500)
      .json({ status: false, message: "something went wrong" });
  }
};

  async getTradeHistory(req, res) {
    const id = res.locals.admin_id;
    const {
      pairName,
      type,
      buyerEmail,
      sellerEmail,
      fromDate,
      toDate,
      page = 1,
      limit = 5,
      status,
    } = req.query;

    try {
      if (!id) {
        return res
          .status(401)
          .json({ status: false, message: "Unauthorized Admin" });
      }

      const skip = (page - 1) * limit;
      const matchStage = {};

      if (pairName) matchStage.pairName = pairName;
      if (type) matchStage.orderType = type;

      if (fromDate && toDate) {
        const from = new Date(fromDate);
        const to = new Date(toDate);
        to.setHours(23, 59, 59, 999);
        matchStage.dateTime = { $gte: from, $lte: to };
      }

      if (status) {
        if (status === "cancelled") {
          matchStage.status = { $in: ["cancelled", "partially cancelled"] };
        } else {
          matchStage.status = status;
        }
      }

      const pipeline = [
        { $match: matchStage },
        {
          $lookup: {
            from: "users",
            localField: "buyerUserId",
            foreignField: "_id",
            as: "buyer",
          },
        },
        { $unwind: { path: "$buyer", preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: "users",
            localField: "sellerUserId",
            foreignField: "_id",
            as: "seller",
          },
        },
        { $unwind: { path: "$seller", preserveNullAndEmptyArrays: true } },

        {
          $lookup: {
            from: "TradeOrders",
            localField: "buyOrderId",
            foreignField: "_id",
            as: "buyOrderDoc",
          },
        },
        { $unwind: { path: "$buyOrderDoc", preserveNullAndEmptyArrays: true } },

        {
          $lookup: {
            from: "TradeOrders",
            localField: "sellOrderId",
            foreignField: "_id",
            as: "sellOrderDoc",
          },
        },
        {
          $unwind: { path: "$sellOrderDoc", preserveNullAndEmptyArrays: true },
        },

        {
          $match: {
            ...(buyerEmail
              ? { "buyer.email": { $regex: buyerEmail, $options: "i" } }
              : {}),
            ...(sellerEmail
              ? { "seller.email": { $regex: sellerEmail, $options: "i" } }
              : {}),
          },
        },
        {
          $project: {
            dateTime: 1,
            pairName: 1,
            orderType: 1,
            filledAmount: 1,
            tradePrice: 1,
            total: 1,
            status: 1,
            buyFee: 1,
            sellFee: 1,
            role: 1,
            buyerName: "$buyer.first_name",
            buyerEmail: "$buyer.email",
            sellerName: "$seller.first_name",
            sellerEmail: "$seller.email",
            orderState: 1,
            takerFee: {
              $cond: [
                { $eq: ["$orderState", "buy"] },
                "$buyFee", // buyer was taker
                "$sellFee", // seller was taker
              ],
            },
            makerFee: {
              $cond: [
                { $eq: ["$orderState", "buy"] },
                "$sellFee", // seller was maker
                "$buyFee", // buyer was maker
              ],
            },
            buyOrderType: "$buyOrderDoc.orderType",
            sellOrderType: "$sellOrderDoc.orderType",

            combinedOrderType: {
              $concat: [
                "$buyOrderDoc.orderType",
                "/",
                "$sellOrderDoc.orderType",
              ],
            },
          },
        },
        { $sort: { dateTime: -1 } },
        { $skip: skip },
        { $limit: parseInt(limit) },
      ];

      const data = await MappingOrders.aggregate(pipeline);

      // Count total results without skip/limit/project
      const countPipeline = pipeline.filter((stage) => {
        return (
          !("$skip" in stage) && !("$limit" in stage) && !("$project" in stage)
        );
      });
      countPipeline.push({ $count: "total" });

      const countResult = await MappingOrders.aggregate(countPipeline);
      const totalItems = countResult.length > 0 ? countResult[0].total : 0;
      // console.log("totalitems", totalItems);

      res.json({
        status: true,
        getTradeHistoryTblDetails: data,
        totalItems,
      });
    } catch (error) {
      console.error("Error in getTradeHistory:", error);
      res.status(500).json({ status: false, message: "Internal server error" });
    }
  }

  getOrderHistory = async (req, res) => {
    const id = res.locals.admin_id;
    const {
      pairName,
      type,
      status,
      fromDate,
      toDate,
      page = 1,
      limit = 10,
      search = "",
    } = req.query;
    // console.log('search===', search)
    try {
      if (!id) {
        return res.send({ status: false, message: "Invalid Admin Login..." });
      }

      let matchQuery = {};
      if (pairName) matchQuery.pairName = pairName;
      if (type) matchQuery.orderType = type;
      if (status) {
        if (status === "cancelled") {
          matchQuery.status = { $in: ["cancelled", "partially cancelled"] };
        } else {
          matchQuery.status = status;
        }
      }
      // if (status) matchQuery.status = status;
      if (fromDate && toDate) {
        const from = new Date(fromDate);
        const to = new Date(toDate);
        to.setHours(23, 59, 59, 999);

        matchQuery.dateTime = {
          $gte: from,
          $lte: to,
        };
      }
      let pipeline = [
        { $match: matchQuery },
        {
          $lookup: {
            from: "users",
            localField: "userId",
            foreignField: "_id",
            as: "tradeOrderData",
          },
        },
        { $unwind: "$tradeOrderData" },
      ];

      if (search) {
        pipeline.push({
          $match: {
            "tradeOrderData.email": { $regex: search, $options: "i" },
          },
        });
      }

      pipeline.push(
        {
          $project: {
            userId: 1,
            type: 1,
            pairName: 1,
            orderType: 1,
            amount: 1,
            price: 1,
            filledAmount: 1,
            fee: 1,
            feeStatus: 1,
            total: 1,
            status: 1,
            dateTime: 1,
            "tradeOrderData.email": 1,
          },
        },
        { $sort: { _id: -1 } },
        { $skip: (page - 1) * limit },
        { $limit: parseInt(limit) }
      );

      const UserTradelist = await TradeOrderHistory.aggregate(pipeline);

      const countPipeline = pipeline.filter((stage) => {
        return (
          !("$skip" in stage) && !("$limit" in stage) && !("$project" in stage)
        );
      });
      countPipeline.push({ $count: "total" });

      const countAggregation = await TradeOrderHistory.aggregate(countPipeline);
      const totalRecords =
        countAggregation.length > 0 ? countAggregation[0].total : 0;
      const totalItems = totalRecords;
      if (!UserTradelist || UserTradelist.length === 0) {
        return res.send({ status: false, message: "No data found" });
      }

      res.send({
        status: true,
        data: UserTradelist,
        pagination: {
          totalRecords,
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalRecords / limit),
          totalItems,
        },
      });
    } catch (error) {
      res
        .status(500)
        .json({ status: false, message: "Error retrieving Trade History" });
    }
  };

  getSwapHistory = async (req, res) => {
    const id = res.locals.admin_id;
    const {
      fromCoin,
      toCoin,
      fromDate,
      toDate,
      page = 1,
      limit = 10,
      search = "",
    } = req.query;

    try {
      if (!id) {
        return res.send({ status: false, message: "Invalid Admin.." });
      }

      const matchStage = {};

      if (fromCoin) matchStage.fromCoin = fromCoin;
      if (toCoin) matchStage.toCoin = toCoin;
      if (fromDate && toDate) {
        const to = new Date(toDate).setHours(23, 59, 59, 999);
        matchStage.createdAt = {
          $gte: new Date(fromDate),
          $lte: new Date(to),
        };
      }

      const searchStage = search
        ? {
            $or: [{ "userData.email": { $regex: search, $options: "i" } }],
          }
        : {};

      const swapData = await Userswapshistory.aggregate([
        {
          $lookup: {
            from: "users",
            localField: "userId",
            foreignField: "_id",
            as: "userData",
          },
        },
        { $unwind: "$userData" },
        { $match: { ...matchStage, ...searchStage } },
        {
          $project: {
            fromCoin: 1,
            toCoin: 1,
            fromAmount: 1,
            toAmount: 1,
            feeAmount: 1,
            receiveAmount: 1,
            rate: 1,
            createdAt: 1,
            email: "$userData.email",
          },
        },
        { $sort: { _id: -1 } },
        { $skip: (page - 1) * limit },
        { $limit: Number(limit) },
      ]);
      const countAggregation = await Userswapshistory.aggregate([
        {
          $lookup: {
            from: "users",
            localField: "userId",
            foreignField: "_id",
            as: "userData",
          },
        },
        { $unwind: "$userData" },
        { $match: { ...matchStage, ...searchStage } },
        { $count: "total" },
      ]);
      const totalRecords =
        countAggregation.length > 0 ? countAggregation[0].total : 0;
      // console.log('totalRecords', totalRecords)
      const totalPages = Math.ceil(totalRecords / limit);
      // console.log('totalPages', totalPages)
      const totalItems = totalRecords;

      if (!swapData || swapData.length === 0) {
        return res.send({ status: false, message: "No data found" });
      }
      res.send({ status: true, data: swapData, totalPages, totalItems });
    } catch (error) {
      res
        .status(500)
        .json({ status: false, message: "Error retrieving Swap History" });
    }
  };

  getUserAssets = async (req, res) => {
    const id = res.locals.admin_id;
    try {
      if (!id) {
        return res.send({ status: false, message: "Invalid Admin!" });
      }

      const depositData = await Transaction.aggregate([
        {
          $group: {
            _id: "$moveCur",
            totalDepositAmount: { $sum: "$amount" },
          },
        },
      ]);

      const adminData = await adminHistory.aggregate([
        {
          $group: {
            _id: "$symbol",
            totalAdminAmount: { $sum: "$amount" },
          },
        },
      ]);

      const totalData = {};
      adminData.forEach((item) => {
        totalData[item._id] = item.totalAdminAmount;
      });

      const userData = depositData.map((tx) => {
        const adminAmount = totalData[tx._id] || 0;
        return {
          symbol: tx._id,
          totalDepositAmount: tx.totalDepositAmount,
          totalAdminAmount: adminAmount,
          remainingAmount: tx.totalDepositAmount - adminAmount,
        };
      });

      if (!userData.length) {
        return res.send({ status: false, message: "No data found" });
      }

      res.send({ status: true, data: userData });
    } catch (error) {
      console.log("error----", error);
      res.status(500).json({
        status: false,
        message: "Error retrieving User Assets Details",
      });
    }
  };

  userDepositCount = async (req, res) => {
    const id = res.locals.admin_id;

    try {
      if (!id) {
        return res.send({ status: false, message: "Invalid Admin!" });
      }

      const depositData = await Transaction.find({ adminMoveStatus: 0 });

      const currencyCounts = {
        ETH: 0,
        USDT: 0,
        SOL: 0,
        BTC: 0,
        ADA: 0,
        LTC: 0,
      };

      depositData.forEach((item) => {
        const currency = item.moveCur ? item.moveCur.toUpperCase() : null;
        if (currency && currencyCounts.hasOwnProperty(currency)) {
          currencyCounts[currency]++;
        }
      });
      res.send({
        status: true,
        total: depositData.length,
        counts: currencyCounts,
      });
    } catch (error) {
      console.log("error----", error);
      res.status(500).json({
        status: false,
        message: "Error retrieving User Deposit Count",
      });
    }
  };

  getFiatAndCryptoHistory = async (req, res) => {
    const id = res.locals.admin_id;
    const {
      fiatCurrency,
      cryptoCurrency,
      type,
      status,
      fromDate,
      toDate,
      page = 1,
      limit = 10,
      search = "",
    } = req.query;
    try {
      if (!id) {
        return res.send({ status: false, message: "Invalid Admin Login..." });
      }

      let matchQuery = {};
      if (fiatCurrency) matchQuery.fiatCurrency = fiatCurrency;
      if (cryptoCurrency) matchQuery.cryptoCurrency = cryptoCurrency;
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
      let pipeline = [
        { $match: matchQuery },
        {
          $lookup: {
            from: "users",
            localField: "userId",
            foreignField: "_id",
            as: "FiatandCryptoOrder",
          },
        },
        { $unwind: "$FiatandCryptoOrder" },
      ];
      if (search) {
        pipeline.push({
          $match: {
            $or: [
              { "FiatandCryptoOrder.email": { $regex: search, $options: "i" } },
              { walletAddress: { $regex: search, $options: "i" } },
              { transactionHash: { $regex: search, $options: "i" } },
              { orderId: { $regex: search, $options: "i" } },
            ],
          },
        });
      }

      pipeline.push(
        {
          $project: {
            userId: 1,
            isBuyOrSell: 1,
            walletAddress: 1,
            transactionHash: 1,
            fiatCurrency: 1,
            cryptoCurrency: 1,
            orderId: 1,
            amountPaid: 1,
            fiatAmount: 1,
            cryptoAmount: 1,
            totalFeeInFiat: 1,
            status: 1,
            completedAt: 1,
            paymentOptionId: 1,
            "FiatandCryptoOrder.email": 1,
          },
        },
        { $sort: { _id: -1 } },
        { $skip: (page - 1) * limit },
        { $limit: parseInt(limit) }
      );

      const UserFiatAndCrypto = await CryptoAndFiat.aggregate(pipeline);

      const countPipeline = pipeline.filter((stage) => {
        return (
          !("$skip" in stage) && !("$limit" in stage) && !("$project" in stage)
        );
      });
      countPipeline.push({ $count: "total" });

      const countAggregation = await CryptoAndFiat.aggregate(countPipeline);

      // console.log(countAggregation)
      const totalRecords =
        countAggregation.length > 0 ? countAggregation[0].total : 0;
      const totalItems = totalRecords;
      if (!UserFiatAndCrypto || UserFiatAndCrypto.length === 0) {
        return res.send({ status: false, message: "No data found" });
      }

      res.send({
        status: true,
        data: UserFiatAndCrypto,
        pagination: {
          totalRecords,
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalRecords / limit),
          totalItems,
        },
      });
    } catch (error) {
      res
        .status(500)
        .json({ status: false, message: "Error retrieving Trade History" });
    }
  };
}
module.exports = new AdmingetMethods();
