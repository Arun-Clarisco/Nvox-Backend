const mongoose = require("mongoose");
const schema = mongoose.Schema

const data = new schema({
    user_id: {
        type: mongoose.Schema.Types.ObjectId, ref: 'Users'
    },
    user_email: {
        type: mongoose.Schema.Types.String, ref: 'Users'
    },
    individualStatus: { type: Number },
    // legal_Entity: {
    //     full_name: { type: String },
    //     abbrevation_Name: { type: String },
    //     foreign_lang_name: { type: String },
    //     data: { type: String },
    //     register_numb: { type: String },
    //     register_authority: { type: String },
    //     register_place: { type: String },
    //     legal_address: { type: String },
    //     postal_address: { type: String },
    //     email_or_url: { type: String },
    //     tax_residency: { type: String },
    //     tax_number: { type: String },
    //     shares: { type: String },
    //     shareHolder: { type: Boolean },
    //     date: { type: String },
    //     stampimage: { type: String },
    // },
    individuals: {
        surname: { type: String },
        dob: { type: String },
        // birth_place: { type: String },
        citizenship: { type: String },
        actual_address: { type: String },
        // domicile: { type: String },
        passport_information: {
            // document_name: { type: String },
            number: { type: String },
            // issuing_body: { type: String },
            expiry_date: { type: String },
            // work_place: { type: String },
            // share_capital: { type: String },
            tax_residency: { type: String },
            tax_number: { type: String },
            source_wealth: { type: String },
            other_option: { type: String },
            public_officials_1: {
                officials_1: { type: Boolean },
                specify_official_1: { type: String, default: "" },
            },
            public_officials_2: {
                officials_2: { type: Boolean },
                specify_official_2: { type: String, default: "" },
                position_held: { type: String, default: "" },
                period: { type: String, default: "" },
                relationship: { type: String, default: "" },
            },
            // shareHolder_nominee: { type: Boolean },
            // phone_number: { type: String },
            // email: { type: String },
            // date: { type: String },
            // signature: { type: String },
        },
        occupation_details: {
            occupation: { type: String },
            other_option: { type: String },
            incomename: { type: String },
            incometransaction: { type: String },
            monthlyincomeamount: { type: String },
            outgoingtransaction: { type: String },
            monthlyoutgoingamount: { type: String },
            purposeofusingrempic: { type: String },
        },
    },
    // ubo: {
    //     first_name: { type: String },
    //     last_name: { type: String },
    //     patronymic: { type: String },
    //     dob: { type: String },
    //     birth_place: { type: String },
    //     citizenship: { type: String },
    //     company_shareCapital: { type: String },
    //     domicile: { type: String },
    //     actual_address: { type: String },
    //     source_wealth: { type: String },
    //     tax_residency: { type: String },
    //     tax_number: { type: String },
    //     public_officials_1: {
    //         officials_1: { type: Boolean },
    //         specify_official_1: { type: String, default: "" },
    //     },
    //     public_officials_2: {
    //         officials_2: { type: Boolean },
    //         specify_official_2: { type: String, default: "" },
    //         position_held: { type: String, default: "" },
    //         period: { type: String, default: "" },
    //         relationship: { type: String, default: "" },
    //     },
    //     position_held: { type: String },
    //     period: { type: String },
    //     relationship: { type: String },
    //     phone_number: { type: String },
    //     passport_information: {
    //         document_name: { type: String },
    //         number: { type: String },
    //         issuing_body: { type: String },
    //         expiry_date: { type: String },
    //         business_activity: { type: String },
    //         signature: { type: String },
    //     }
    // }
})

module.exports = mongoose.model("Users_Individuals", data)