
const socketHelper = require("./socketCommon");
const socketData = require("../userControllers/trade");
const liveData =require('../userControllers/userController')

exports.initialCall = () => {
    const socketio = socketHelper.GetSocket();
    
    socketData.fetchPairData(socketio);
}