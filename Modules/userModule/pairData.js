const mongoose = require("mongoose");

const schema = new mongoose.Schema({
    symbol: { type: String },
    name: { type:String },
    logo: { type:String },
    current_price: { type: Number },
    highest_price: { type: Number },
    lowest_price: { type: Number },
    volume: { type: Number },
    change_24h: { type: Number },
    change_percentage:{type:Number},
    volume_24h_USDT:{ type: Number },
    minimumTradeTotal: { type: Number },
    makerFee: { type: Number },
    takerFee: { type: Number },
    withdrawFee: { type: Number },
    swapFee: { type: Number },
    withdrawMinimumAmount : {type: Number}
})

module.exports = mongoose.model("Currency_Data", schema)