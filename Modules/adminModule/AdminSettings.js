const mongoose = require("mongoose");
const schema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId },
    evm_address: { type: String },
    evm_key: { type: String },
    btc_address: { type: String, default: "" },
    btc_publicKey: { type: String, default: "" },
    btc_seed: { type: String, default: "" },
    sol_address: { type: String, default: "" },
    sol_key: { type: String, default: "" },
    ltc_address: { type: String, default: "" },
    ltc_key: { type: String, default: "" },
    ltc_seed: { type: String, default: "" },
    ada_address: { type: String, default: "" },
    ada_key: { type: String, default: "" },
})

module.exports = mongoose.model("Admin_Settings", schema)