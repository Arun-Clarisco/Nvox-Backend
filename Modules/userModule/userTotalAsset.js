const mongoose = require("mongoose");

const TotalValueSchema = new mongoose.Schema({
    userId: { type: String, unique: true },
    // totalValue: { type: Number, required: true },
    currentDayPrice: [
        {
            day: { type: Date, default: Date.now },
            totalInUSD: { type: Number }
        }
    ],
});

module.exports = mongoose.model("TotalAssetChart", TotalValueSchema)