var mongoose = require('mongoose');
var Schema = mongoose.Schema;

const adminActivity = new Schema({
  Id: { type: mongoose.Schema.Types.ObjectId, index: true },
  ip: { type: String, default: "" },
  browser: { type: String, default: "" },
  type: { type: String, default: "" }, 
  AdminEmail : { type: String, default: "" }, 
  AdminName: { type: String, default: "" },
  lastId: { type: String, index: true },
  comment: { type: String, default: "" },
  dateTime: { type: Date, default: Date.now },
});

module.exports = mongoose.model("AdminActivity", adminActivity, 'AdminActivity');
