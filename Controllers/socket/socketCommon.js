var socket = 0;
// here socket connect
exports.SocketInitial = function (socketIO) {
  socket = socketIO;
};
exports.GetSocket = function () {
    return socket;
};
