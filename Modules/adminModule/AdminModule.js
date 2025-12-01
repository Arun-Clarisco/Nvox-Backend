const mongoose = require("mongoose");
const { type } = require("os");
const adminSchema = new mongoose.Schema({
  adminName: {
    type: String,
  },
  email: {
    type: String,
    unique: true,
  },
  password: {
    type: String,
    default: "",
  },
  lastLoginIP: {
    type: String,
  },
  admin_auth: {
    type: String,
    default: "",
  },
  admin_type: {
    type: String,
  },
  active_status: {
    type: String,
    default: "Active",
  },
  adminPermissions: {
    adminActivity: {
      View: { type: Number, default: 0 },
      //  Edit: { type: Number, default: 0 },
    },
    adminTransfer: {
      View: { type: Number, default: 0 },
      Edit: { type: Number, default: 0 },
    },
    accounts: {
      View: { type: Number, default: 0 },
      Edit: { type: Number, default: 0 },
    },
    pairList: {
      View: { type: Number, default: 0 },
      Edit: { type: Number, default: 0 },
    },
    userRequest: {
      View: { type: Number, default: 0 },
      Edit: { type: Number, default: 0 },
    },
    transactionList: {
      View: { type: Number, default: 0 },
    },
    orderHistory: {
      View: { type: Number, default: 0 },
    },
    tradeHistory: {
      View: { type: Number, default: 0 },
    },
    cryptoFiat: {
      View: { type: Number, default: 0 },
    },
    swapHistory: {
      View: { type: Number, default: 0 },
    },
    notification: {
      View: { type: Number, default: 0 },
      Edit: { type: Number, default: 0 },
    },
    adminSetting: {
      View: { type: Number, default: 0 },
      Edit: { type: Number, default: 0 },
    },
    siteSetting: {
      View: { type: Number, default: 0 },
      Edit: { type: Number, default: 0 },
    },
    cms: {
      View: { type: Number, default: 0 },
      Edit: { type: Number, default: 0 },
    }, 
    supportTicket: {
      View: { type: Number, default: 0 },
      Edit: { type: Number, default: 0 },
    }

  },
  createDate: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("admin", adminSchema);
