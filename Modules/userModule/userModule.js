const mongoose = require("mongoose");
const schema = mongoose.Schema

const data = new schema({
    first_name: { type: String },
    last_name: { type: String },
    email: { type: String, unique: true },
    verifyOTP: { type: String },
    password: { type: String },
    referral_id: { type: String },
    user_auth: { type: String },
    account_status: { type: String, default: "Active" },
    profile: { type: String , default: ""},
    createdDate: { type: Date, default: Date.now },
    registerType: { type: String, default: "" },
    deletedDate:{ type: Date, default: null },
    deletedBy : { type: String, default: "" }, 
    TFAStatus: { type: Boolean, default: true },
    TFASecretKey: { type: String, default: '' },  
    TFAEnableKey: {type:  String, default: ""}, 
    adminDisableStatus : { type: Number, default: 0 }

})

module.exports = mongoose.model("Users", data)