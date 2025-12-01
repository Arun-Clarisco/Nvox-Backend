var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var supportTicker = new Schema({
    ticketId: {
        type: String,
        required: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Users',
        required: true
    },
    date: {
        type: Date,
        default: Date.now
    },
    subject: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Issue',
        required: true
    },
    status: {
        type: Number,
        enum:[0, 1], // 0 - closed, 1 - opened
        required: true
    },
    description: {
        type: String,
        required: true
    },
    images: {
        type: String,
        default: '',
        // required: true
    },
    chatHistory: [{
        userId  : { type: mongoose.Schema.Types.ObjectId, ref: 'Users', 'index':true},
        message : { type: String, default: '' },
        userType: { type: String },
        chattingImage  : { type: String, default: '' },
        createdDate     : { type: Date, default: Date.now },
        readByUser: { type: Boolean, default: false },
    }]
});

module.exports = mongoose.model('TicketSupport', supportTicker, 'TicketSupport')