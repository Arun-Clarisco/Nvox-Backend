const notificationModel = require('../../Modules/userModule/notification');
const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;

const notificationController = {


  async clearAllNotification(req, res) {
    try {
      const { usersId } = req.body;
      const objectId = new ObjectId(usersId);

      // First, try updating existing userList entries
      const updateResult = await notificationModel.updateMany(
        {
          notificationType: "admin",
          "userList.usersId": objectId
        },
        {
          $set: {
            "userList.$[elem].readStatus": 1,
            "userList.$[elem].status": 1,
            "userList.$[elem].clearStatus": 1
          }
        },
        {
          arrayFilters: [{ "elem.usersId": objectId }]
        }
      );

      // If no existing entries were updated, push a new one
      if (updateResult.modifiedCount === 0) {
        await notificationModel.updateMany(
          { notificationType: "admin" },
          {
            $push: {
              userList: { usersId: objectId, readStatus: 1, status: 1, clearStatus: 1 }
            }
          }
        );
      }


      await notificationModel.updateMany(
        {
          notificationType: "supportTicket",
          "userList.usersId": objectId
        },
        {
          $set: {
            "userList.$[elem].readStatus": 1,
            "userList.$[elem].status": 1,
            "userList.$[elem].clearStatus": 1
          }
        },
        {
          arrayFilters: [{ "elem.usersId": objectId }]
        }
      );

      res.send({ status: true, message: "All notifications cleared" });
    } catch (error) {
      console.error(error);
      res.send({ status: false, message: "Failed to clear notifications" });
    }
  },

  async getAllNotification(req, res) {
    try {
      const { userId } = req.body;
      // console.log("userId--", userId);

      if (!userId) {
        return res.send({ status: false, message: "User ID is required" });
      }

      // const data = await notificationModel.find({
      //   $or: [
      //     // Admin notifications
      //     {
      //       notificationType: "admin",
      //       $or: [
      //         { "userList.usersId": { $ne: userId } },
      //         { "userList.clearStatus": { $ne: 1 } }
      //       ]
      //     },
      //     // SupportTicket notifications
      //     {
      //       notificationType: "supportTicket",
      //       $or: [
      //         { "userList.usersId": { $ne: userId } },
      //         { "userList.clearStatus": { $ne: 1 } }
      //       ]
      //     }
      //   ]
      // }).sort({ _id: -1 });

      const data = await notificationModel.find({
        $or: [
          // Admin notifications (userList tracks each user)
          {
            notificationType: "admin",
            $or: [
              { userList: { $not: { $elemMatch: { usersId: userId, clearStatus: 1 } } } },
              { userList: { $elemMatch: { usersId: userId, clearStatus: { $ne: 1 } } } }
            ]
          },
          // SupportTicket notifications (userList has only target user)
          {
            notificationType: "supportTicket",
            userList: { $elemMatch: { usersId: userId, clearStatus: { $ne: 1 } } }
          }
        ]
      }).sort({ _id: -1 });



      // console.log("data===", data);


      const count = data.filter(noti => {
        const userEntry = noti.userList.find(u => u.usersId.toString() === userId);
        if (noti.notificationType === "admin") {
          return !userEntry || userEntry.readStatus !== 1;
        } else if (noti.notificationType === "supportTicket") {
          return userEntry && userEntry.readStatus !== 1;
        }
        return false;
      }).length;

      // console.log("count00", count);


      return res.send({ status: true, message: "Notifications fetched", data, count });
    } catch (error) {
      console.error(error);
      res.send({ status: false, message: "Something went wrong" });
    }
  },



  //   async getAllNotification(req, res) {
  //   try {
  //     const { userId } = req.body;

  //     if (!userId) {
  //       return res.send({ status: false, message: "User ID is required" });
  //     }

  //     // console.log("userId", userId);

  //     const data = await notificationModel.find({
  //       notificationType: "admin",
  //       $or: [
  //         {
  //           userList: {
  //             $not: {
  //               $elemMatch: { usersId: userId }
  //             }
  //           }
  //         },
  //         {
  //           userList: {
  //             $elemMatch: {
  //               usersId: userId,
  //               clearStatus: { $ne: 1 }
  //             }
  //           }
  //         }
  //       ]
  //     }).sort({ _id: -1 });

  //     const count = await notificationModel.countDocuments({
  //         notificationType: "admin",
  //         $or: [
  //           { "userList.usersId": { $ne: userId } },
  //           { "userList.readStatus": { $ne: 1 } }
  //         ]
  //       });

  //     return res.send({
  //       status: true,
  //       message: "Unread notifications",
  //       data,
  //       count
  //     });
  //   } catch (error) {
  //     console.error("getAllNotification error:", error);
  //     res.send({ status: false, message: "Something went wrong" });
  //   }
  // },

  async readMessage(req, res) {
    try {
      const { notifyId, userId } = req.body;

      // console.log({ notifyId, userId });

      const existData = await notificationModel.findOne({
        _id: notifyId,
        "userList.usersId": userId,
      });


      if (existData) {
        // console.log("work if");
        await notificationModel.findOneAndUpdate(
          { _id: notifyId, "userList.usersId": userId },
          {
            $set: {
              "userList.$.readStatus": 1,
              "userList.$.status": 1,
            },
          }
        );
      } else {
        // console.log("work else");

        await notificationModel.findOneAndUpdate(
          { _id: notifyId },
          {
            $addToSet: {
              userList: { usersId: userId, readStatus: 1, status: 1 },
            },
          },
        );
      }

      res.send({ status: true, message: "Message Is Readed!" });
    } catch (error) {
      res.send({ status: false, message: "Something went wrong" });
    };
  }


};

module.exports = notificationController;