// models/userSwapHistory.js
const mongoose = require("mongoose");

const adminswapfeeHistorySchema = new mongoose.Schema(
  {
    Userid: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "User",
    },
    Currencysymbol: {
      type: String,
      required: true,
    },
    Amount: {
      type: Number,
      required: true,
    },
    AmountinUSD: {
      type: Number,
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("adminSwapfeeHistory", adminswapfeeHistorySchema);
