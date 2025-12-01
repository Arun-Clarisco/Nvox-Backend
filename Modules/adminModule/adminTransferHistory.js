var mongoose = require('mongoose');

const adminHistory = new mongoose.Schema({
    from: { type: String },
    toaddress: { type: String, required: true },
    amount: { type: Number, required: true },
    txnId: { type: String },  // Ensure txnId can be null
    symbol: { type: String },
    createdDate: { type: Date, default: Date.now }
});


module.exports = mongoose.model('Admin-move-history', adminHistory)