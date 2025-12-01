const Notification = require('../../Modules/userModule/notification');
let socket = null;

exports.SocketInit = function(socketIO) {
  socket = socketIO;
};

exports.sendNotification = async function () {
  try {
    const findQ = { notificationType: "admin" };
    const notifications = await Notification.find(findQ).sort({ _id: -1 });  
    // console.log("notifications", notifications) ;
    return; 
    return notifications;
  } catch (err) {
    console.error("Notification error:", err);
  }
};

exports.getUserId = async function (userId) {
  try {
    const findQ = {
      notificationType: "admin",
      $or: [
        { userList: { $size: 0 } },
        { userList: { $not: { $elemMatch: { usersId: mongoose.Types.ObjectId(userId) } } } }
      ]
    };
    const notifications = await Notification.find(findQ).sort({ _id: -1 });
    return notifications;
  } catch (err) {
    console.error("Notification error:", err);
  }
};
