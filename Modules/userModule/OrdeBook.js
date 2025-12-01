var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var orderBookSchema = new Schema({
    "bids"   : { type: Object, default: {} },
    "asks"   : { type: Object, default: {} },
    "symbol"   : { type: String, required: true, index: true, unique: true },
    "liquidityDataTime":  { type: Date, default: Date.now },
});

module.exports = mongoose.model('OrderBook', orderBookSchema)