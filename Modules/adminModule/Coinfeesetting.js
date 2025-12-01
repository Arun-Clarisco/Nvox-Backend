const mongoose = require('mongoose')
const coinfeesettingSchema = new mongoose.Schema({
    adminid: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'admin'
    },
    BTCUSDT: {
        type: Number,
        default: 0
    },
    ETHUSDT: {
        type: Number,
        default: 0
    },
    SOLUSDT: {
        type: Number,
        default: 0
    },
    ADAUSDT: {
        type: Number,
        default: 0
    },
     LTCUSDT: {
        type: Number,
        default: 0
    } ,
    USDT: {
        type: Number,
        default: 0
    },

})

module.exports = mongoose.model("coinfeeSetting",coinfeesettingSchema);