const mongoose = require('mongoose');
const Schema = mongoose.Schema;

var addressSchema = new Schema({
	"user_id": { type: mongoose.Schema.Types.ObjectId, index: true, ref: 'Users' },
	"address": { type: String, default: '' },
	"currencyname": { type: String, index: true, default: '' },
	"encData": { type: String, default: '' },
	"tag": { type: String, default: '' },
	"tagType": { type: String, default: '' },
	"ethBlock": { type: Object, default: { eth: 0, token: 0 } },
	"solBlock":{type: Object, default: { sol: 0, token: 0 } },
	"adaBlock": {type:Object, default: {ada:0, token:0}},
	"btcBlock": {type:Object, default: {btc:0, token:0}},
	"ltcBlock": {type:Object, default: {ltc:0, token:0}},
	"datecreated": { type: Date, default: Date.now },
	"referenceId": { type: String, lowercase: true, required: true, index: true, unique: true },
});

addressSchema.pre('validate', function (next) {
	const address = this;
	let txnRef = address.currencyname + '-' + address.user_id.toString();
	address.referenceId = txnRef;
	next();
});
module.exports = mongoose.model('CoinAddress', addressSchema, 'CoinAddress')