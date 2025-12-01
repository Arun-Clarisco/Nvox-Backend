const mongoose = require('mongoose');

const AdminResetTokenSchema = new mongoose.Schema({
  adminResetToken: { type: String, required: true, unique: true },
  createdAt: { type: Date, default: Date.now},
});

module.exports = mongoose.model("adminResetToken", AdminResetTokenSchema)