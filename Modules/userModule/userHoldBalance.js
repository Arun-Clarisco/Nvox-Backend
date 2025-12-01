const mongoose = require("mongoose");
const schema = mongoose.Schema

const data = new schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'Users' },
    coinId: { type: mongoose.Schema.Types.ObjectId, ref: 'Currency_Data' },
    

})

module.exports = mongoose.model("Hold_Balance", data)