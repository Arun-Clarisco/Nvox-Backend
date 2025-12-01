const mongoose = require('mongoose');

const userBalance = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'Users', unique: true, index: true, required: true },
    USDT_Balance: { type: Number, default: 0 },
    ETH_Balance: { type: Number, default: 0 },
    BTC_Balance: { type: Number, default: 0 },
    SOL_Balance: { type: Number, default: 0 },
    LTC_Balance: { type: Number, default: 0 },
    CARDONA_Balance: { type: Number, default: 0 },
});

// ❌ DON'T call createIndex here on schema
// ✅ MOVE this line *after* model creation
const UserBalance = mongoose.model('User_Balance', userBalance, 'User_Balance');

// ✅ Now call createIndexes() on the model
UserBalance.createIndexes();

module.exports = UserBalance;
