const mongoose = require("mongoose")
const datas = mongoose.Schema
const kycSchema = new datas({
    user_id: {
        type: mongoose.Schema.Types.ObjectId, ref: 'Users'
    },
    user_email: {
        type: mongoose.Schema.Types.String, ref: 'Users'
    },
    KYC_document: [{
        citizenship: { type: String },
        country: { type: String },
        US_resident: { type: Boolean },
        occupation: { type: String },
        tax_ID: { type: String },
    }],
    birth_information: [{
        birthday: { type: String },
        birth_place: { type: String },
        gender: { type: String }
    }],
    legal_document: { type: Boolean },
    privacy_policy: { type: Boolean },
    bank_account: { type: Boolean },
    phone_number: [{
        country: { type: String },
        country_code: { type: String },
        number: { type: String },
        phoneNo_verify: { type: Boolean }
    }],
    current_Address: [{
        address_1: { type: String },
        address_2: { type: String },
        resident_country: { type: String },
        state: { type: String },
        city: { type: String },
        zip_code: { type: String },
        sumsub_status: {type: Boolean}
    }],
    kyc_Status: { type: String },
    sdk_verification: {
        externalUserID: { type: String },
        applicantID: { type: String },
        sdkStatus: { type: String, default: "" },
        reviewResult:{ type: String, default: "" },
        reviewRejectType:{ type: String, default: "" },
    }
})

module.exports = mongoose.model("KYC_Verification", kycSchema)