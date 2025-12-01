var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var ticketReply = new Schema({
    ticketId: {
        type: mongoose.Types.ObjectId,
        ref: 'TicketSupport',
        required: true
    },
    userType: {
        type: String,
        required: true
    },
    date: { 
        type: Date,
        default: Date.now
    },
    message: {
        type: String,
        required: true
    },
    images: {
        type: String,
        required: true
    }
});

module.exports = mongoose.model('TicketReply', ticketReply, 'TicketReply')