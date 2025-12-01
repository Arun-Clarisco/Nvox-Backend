const socketHelper = require("./socketCommon");

const userAuth = require("../../Auth/userAuth")

let listenerAdded = false;
exports.afterDbConnected = async () => {
  const io = socketHelper.GetSocket();
  require('./socketHelper').initialCall();
  if (listenerAdded) return;
  listenerAdded = true;
  // let listenerAdded = false;
  // if (listenerAdded) {
  //   console.log("Socket connection listener already added. Skipping.");
  //   return;
  // }
  // listenerAdded = true;
  
}