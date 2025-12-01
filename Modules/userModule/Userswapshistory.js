// models/userSwapHistory.js
const mongoose = require("mongoose");

const userSwapHistorySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "User",
    },
    fromCoin: {
      type: String,
      required: true,
    },
    toCoin: {
      type: String,
      required: true,
    },
    fromAmount: {
      type: Number,
      required: true,
    },
    toAmount: {
      type: Number,
      required: true,
    },
    receiveAmount: {
      type: Number,
      required: true,
    },
    feeAmount: {
      type: Number,
      required: true,
    },
    rate: {
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

module.exports = mongoose.model("userSwapHistory", userSwapHistorySchema);
