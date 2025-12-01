const mongoose = require('mongoose');

const tradeOrdersSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'Users', index: true, required: true },
  amount: { type: Number, default: 0, required: true },
  filledAmount: { type: Number, default: 0 },
  pendingAmnt: { type: Number, default: 0 },
  price: { type: Number, default: 0, required: true },
  usdPrice: { type: Number, default: 0, required: true },
  totalUsdPrice: { type: Number, default: 0, required: true },
  type: { type: String, required: true }, // buy or sell
  total: { type: Number, default: 0 },
  beforeUsdtBal: { type: Number, default: 0 },
  beforePairBal: { type: Number, default: 0 },
  creditAmount: { type: Number, default: 0 },
  fee: { type: Number, default: 0 },
  feeStatus: { type: String, default: "" },
  orderType: { type: String, required: true },
  dateTime: { type: Date, default: Date.now },
  pair: { type: mongoose.Schema.Types.ObjectId, ref: 'Pairs', index: true, required: true },
  pairName: { type: String, index: true },
  status: { type: String, default: 'pending', index: true },
  referenceId: { type: String, unique: true, index: true },
  isProcessed: { type: Boolean, default: false },
  isProcessing: { type: Boolean, default: false, index: true },
  updateAt: { type: Date, default: null },
});

tradeOrdersSchema.pre('validate', function (next) {
  const trade = this;
  if (!trade.referenceId) {
    trade.referenceId = new mongoose.Types.ObjectId(); // Generate a unique reference ID
  }
  next();
});

module.exports = mongoose.model('TradeOrders', tradeOrdersSchema, 'TradeOrders');
