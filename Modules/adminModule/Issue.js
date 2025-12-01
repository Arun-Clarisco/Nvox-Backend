var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var issue = new Schema({
	"issueTitle"   : {type:String, required: true, index: true},
});
module.exports = mongoose.model('Issue', issue, 'Issue')