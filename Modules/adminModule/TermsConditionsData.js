const mongoose = require("mongoose")
const { type } = require("os")
const Schema = mongoose.Schema

const createTermsConditionSchema= new Schema({ 
    Title: {
        type: String, 
    },
    TermsContent: {
        type: String
    }, 
    Note: {
        type : String,  
        default: "", 
    }, 
    date: {
        type: Date,
        default: Date.now  
    }
})

const createTermsPageSchema = mongoose.model("TermsConditionsPages", createTermsConditionSchema)
module.exports = createTermsPageSchema