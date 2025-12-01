var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var notificationSchema = new Schema({
	"title": { type: String, default: '' },
	"message": { type: String, default: '' },
	"status": { type: Number, default: 0 },
	"userId": { type: mongoose.Schema.Types.ObjectId,  ref: 'Users' },
	"activity": { type: Object, default: {} },
	"detail": { type: Object, default: {} },
	"type": { type: String },
	"notificationType": { type: String },
	"link": { type: String },
	"userList": [{
		"usersId": { type: mongoose.Schema.Types.ObjectId },
		"status": { type: Number, default: '1' },
		"readStatus": { type: Number, default: 0 },
		"clearStatus": { type: Number, default: 0 }
	}],
	"createdDate": { type: Date, default: Date.now }	
});
module.exports = mongoose.model('Notification', notificationSchema, 'Notification')