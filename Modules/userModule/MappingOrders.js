var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var genSchema = new Schema({
  "sellOrderId": { type: mongoose.Schema.Types.ObjectId, index: true, ref: 'TradeOrders' },
  "sellerUserId": { type: mongoose.Schema.Types.ObjectId, index: true, ref: 'Users' },
  "tradePrice": { type: Number, default: 0 },
  "filledAmount": { type: Number, default: 0 },
  "buyOrderId": { type: mongoose.Schema.Types.ObjectId, index: true, ref: 'TradeOrders' },
  "buyerUserId": { type: mongoose.Schema.Types.ObjectId, index: true, ref: 'Users' },
  "buyPrice": { type: Number, default: 0 },
  "sellPrice": { type: Number, default: 0 },
  "dateTime": { type: Date, default: Date.now },
  "pair": { type: mongoose.Schema.Types.ObjectId, index: true, ref: 'Currency_Data' },
  "role": { type: String, index: true, default: "" },
  "pairName": { type: String, index: true },
  "total": { type: Number, default: 0 },
  "buyFee": { type: Number, default: 0 },
  "orderType": { type: String, default: '' },
  "orderState": { type: String, default: '' },
  "sellFee": { type: Number, default: 0 },
  "convertedAmount": { type: Number, default: 0 },
  "referenceId": { type: String, lowercase: true, required: true, index: true, unique: true },
  "status": { type: String, default: "filled" }, // filled, cancelled
  "beforeUsdtBal": { type: Number, default: 0 },
  "beforePairBal": { type: Number, default: 0 },
  "afterUsdtBal": { type: Number, default: 0 },
  "afterPairBal": { type: Number, default: 0 },
});

genSchema.pre('validate', function (next) {
  const mapOrders = this;

  let txnRefParts = [
    mapOrders.pairName || '',
    mapOrders.filledAmount || 0,
    mapOrders.tradePrice || 0,
    mapOrders.sellOrderId ? mapOrders.sellOrderId.toString() : 'unknown',
    new Date(mapOrders.dateTime || Date.now()).getTime()
  ];

  mapOrders.referenceId = txnRefParts.join('-');
  next();
});
module.exports = mongoose.model('MappingOrders', genSchema, 'MappingOrders')


