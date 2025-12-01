var mongoose = require('mongoose');

const fiatOrderHistory = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    orderId: { type: String },
    fiatCurrency: { type: String },
    cryptoCurrency: { type: String },
    isBuyOrSell: { type: String },
    fiatAmount: { type: String },
    amountPaid: { type: String },
    paymentOptionId: { type: String },
    network: { type: String },
    cryptoAmount: { type: String },
    conversionPrice: { type: String },
    totalFeeInFiat: { type: String },
    walletAddress: { type: String, default: "--" },
    fromWalletAddress: { type: String },
    completedAt: { type: Date },
    transactionHash: { type: String, default: "--" },
    transactionLink: { type: String },
    status: { type: String },
    ipAddress: { type: String },
});


module.exports = mongoose.model('Fiat-OrderHistory', fiatOrderHistory)