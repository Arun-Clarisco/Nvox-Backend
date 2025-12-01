const mongoose = require("mongoose");
const SiteSettingSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "admin" },
    emailSubject: { type: String, default: "" },
    emailContent: { type: String, default: "" },
    expireTime: { type: Number, default: "" },
    resendOTPexpireTime: { type: Number, default: "" },
    copyright: { type: String, default: "" },
    logo: { type: String, default: "" },
    logoPosition: { type: String, default: '' },
    lastLine: { type: String, default: "" },
},{ timestamps: true });

module.exports = mongoose.model("sitesetting", SiteSettingSchema)