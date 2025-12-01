const mongoose = require("mongoose")
const datas = mongoose.Schema
const PhoneVerificationSchema = new datas({

    user_email: {
        type: String
    },
    phone_number: [{
        country: { type: String },
        country_code: { type: String },
        number: { type: String },
        phoneNo_verify: { type: Boolean }
    }],
})

module.exports = mongoose.model("phone_verification", PhoneVerificationSchema)