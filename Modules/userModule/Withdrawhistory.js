var mongoose = require('mongoose');

const WithdrawSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    from: { type: String },
    toaddress: { type: String, required: true },
    liveusdPrice: { type: Number },
    // amount: { type: Number, required: true },
    // TotalAmount_in_usdprice: {type: Number},
    // fees: { type: String },
    amount: { type: String },
    fees: { type: String },
    TotalAmount_in_usdprice: { type: String },
    txnId: { type: String },  // Ensure txnId can be null
    status: { type: Number, enum: [0, 1, 2], default: 0 },
    reason: { type: String },
    moveCur: { type: String, default: "ETH" },
    createdDate: { type: Date, default: Date.now }
});


module.exports = mongoose.model('WithdrawTransactio', WithdrawSchema)