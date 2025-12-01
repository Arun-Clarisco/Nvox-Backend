const mongoose = require("mongoose");
const schema = mongoose.Schema

const BussinessUser = new schema({
    user_id: {
        type: mongoose.Schema.Types.ObjectId, ref: 'Users'
    },
    user_email: {
        type: mongoose.Schema.Types.String, ref: 'Users'
    },
    firstname: { type: String },
    abbreviatename: { type: String,default: "" },
    foreignlanguagesname: { type: String ,default: ""},
    Date: { type: String },
    Registration_number: { type: String },
    Registration_authority: { type: String },
    placeofregistration: { type: String },
    legal_address: { type: String },
    postal_address: { type: String },
    emailURL: { type: String },
    licensein_formation: {
        typeof_Activity: { type: String },
        licenseNo: { type: String },
        dateofIssue: { type: String },
        issuing_Authority: { type: String },
        validity: { type: String },
        country_taxresidency: { type: String },
        taxnumber: { type: String },
    },
    sharecaptial: {
        registered_sharecapital: { type: String },
        paid_sharecaptial: { type: String },
        numberofpersonnel: { type: String },
        legalproceedingsCompany: {
            bankruptcy: { type: Boolean },
            bankruptcyspecify: { type: String, default: "" }
        },
        financialobligations: {
            lackoffunds_bankaccounts: { type: Boolean },
            financialspecify: { type: String, default: "" },
        },
    },

    listoftheBoardofDirectors: {
        DirectorFirstnominee:{type: String},
        Directoractingnominee1: { type: Boolean },
        DirectorSecondnominee:{type: String},
        Directoractingnominee2: { type: Boolean },
        DirectorThirdnominee:{type: String},
        Directoractingnominee3: { type: Boolean },
        DirectorFourthnominee:{type: String},
        Directoractingnominee4: { type: Boolean },
        DirectorFifthnominee:{type: String},
        Directoractingnominee5: { type: Boolean }
    },
    NameoftheCFO: { type: String },
    details_Beneficialowner: { type: String },
    detailsofShareholders: {
        firstshareholder:{type: String},
        percentageofsharesheld1: { type: String },
        Shareholdernomuinee1:{type: Boolean},
        secondshareholder:{type: String},
        percentageofsharesheld2: { type: String },
        Shareholdernomuinee2:{type: Boolean},
        thirdshareholder:{type: String},
        percentageofsharesheld3: { type: String },
        Shareholdernomuinee3:{type: Boolean},
        fourthshareholder:{type: String},
        percentageofsharesheld4: { type: String },
        Shareholdernomuinee4:{type: Boolean},
    },
    Types_activity: {type: String},
    Business_activity:{type: String},
    financial_legislation: {
        legislation_framework: { type: Boolean },
        legislationspecify: { type: String, default: "" }
    },
    business_activityarea: { type: String },
    averageamount_Transactions: { type: String },
    website_Company: { type: String },
    competitors_Company: { type: String },
    generalAMLpolicies: {
        Amlpolicies1: {
            regulatory_authority: { type: String },
            moneylaundering_prevention: { type: String },
            operating_licensenumber: { type: String }
        },
        Amlpolicies2: { type: String },
        Amlpolicies3: {
            AML_CTFprogram1: { type: String },
            Aml_CTFprogram2: {
                CompleteName1: { type: String ,default:""},
                Position_Title1: { type: String,default:"" },
                Mailing_Address1: { type: String,default:"" },
                Telephone_Number1: { type: String,default:"" }
            },
            Aml_CTFprogram3: { type: String },
            Aml_CTFprogram4: {
                CompleteName2: { type: String,default:"" },
                Position_Title2: { type: String,default:"" },
                Mailing_Address2: { type: String,default:"" },
                Telephone_Number2: { type: String,default:"" }
            },
        },
        Amlpolicies4: { type: String },
        Amlpolicies5: {
            AMLprogram_Directors: { type: String },
            AMLprogram_DirectorsSpecify: { type: String ,default:""}
        },
        Amlpolicies6: { type: String },
        Amlpolicies7: { type: String },
        Amlpolicies8: { type: String },
        Amlpolicies9: {
            investigation_MLandCTF: { type: String },
            investigation_MLandCTFSpecify: { type: String,default: "" }
        },
        Amlpolicies10: {
            enforcement_action: { type: String },
            enforcement_actionAssessed: { type: String}
        },
        Amlpolicies11: {
            MLandCTF_crimes: { type: String },
            MLandCTF_crimesSpecify: { type: String,default: "" }
        },
        Amlpolicies12: { type: String },
        Amlpolicies13: { type: String },
        Amlpolicies14: {
            prohibit_opening: { type: String },
            prohibit_openingSpecify: { type: String,default: "" }
        },
    },
    Documentation: [{
        Memorandum_document: { type: String },
        Incorporation_document: { type: String },
        Directors_document: { type: String },
        goodstanding_document: { type: String },
        Incumbency_document: { type: String },
        Shareholders_document: { type: String },
        Legalownership_document: { type: String },
        Operatinglicense_document: { type: String },
        DeclarationofTrust_document: { type: String },
        TrustSettlement_document: { type: String },
        OnboardingForm_document: { type: String },
        Annualfinancial_document: { type: String },
        Auditedfinancial_document: { type: String },
        absenceof_document: { type: String },
        IdentityCardorPassport_document: { type: String },
        permanentaddress_document: { type: String },
        Accountopening_document: { type: String },
        AML_CTF_document: { type: String },
        signature: { type: String },

    }],
   
})

module.exports = mongoose.model("Users_Bussiness", BussinessUser)