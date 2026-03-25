const mongoose = require("mongoose");
const Config = require("../../Config/config");
const IssueModel = require("../../Modules/adminModule/Issue");
const Ticket = require("../../Modules/SupportTicket");
const Admin = require("../../Modules/adminModule/AdminModule");
const Users = require("../../Modules/userModule/userModule");
const socketHelper = require("../socket/socketCommon");
const siteSetting = require("../../Modules/adminModule/SiteSetting");
const Notification = require("../../Modules/userModule/notification");
const path = require("path");
const fs = require("node:fs");
const nodemailer = require("nodemailer");
const hbs = require("nodemailer-express-handlebars");
const supportTicMail = path.resolve(
  __dirname,
  "../EmailTemplates/mailBody/supportTicketMail.txt"
);
const closeTicket = path.resolve(
  __dirname,
  "../EmailTemplates/mailBody/ticketClose.txt"
);
const { encryptData, decryptData } = require("../../Config/Security");
const { adminActivity } = require("./SubAdminController");
const UserDb = require("../../Modules/userModule/userModule");

const transporter = nodemailer.createTransport({
  host: `${Config.SMTP_Host}`,
  port: 465,
  secure: true, //ssl
  auth: {
    user: `${Config.mailCredUserName}`,
    pass: `${Config.mailCredPassword}`,
  },
});
const viewPath = path.resolve(__dirname, "./EmailTemplates/");
const options = {
  viewEngine: {
    extname: ".handlebars",
    layoutsDir: viewPath,
    defaultLayout: "confirmMail",
  },
  viewPath: viewPath,
  extName: ".handlebars",
};
transporter.use("compile", hbs(options));

const PassMailSend = (to, sub, emailBody) => {
  try {
    let mailOptions = {
      from: `${Config.mailFromAddress2}`,
      to: `${to}`,
      subject: `${sub}`,
      html: `${emailBody}`,
    };
    transporter.sendMail(mailOptions, (err, info) => {
      if (err) {
        console.error("Error sending email:", err);
      } else {
        console.log("Mail sent successfully", info.response);
      }
    });
  } catch (error) {
    console.error("Error sending email:", error);
  }
};

const supportTicketAdminController = {
  async createIssue(req, res) {
    try {
      const data = req.body;
      const newIssue = new IssueModel(data);
      await newIssue.save();
      return res.json({ status: true, data: "Issue Title Created" });
    } catch (err) {
      if (err) throw err;
    }
  },

  async viewTicket(req, res) {
    try {
      const tickets = await Ticket.find()
        .populate({ path: "userId", select: "email first_name" })
        .populate("subject")
        .exec();
      return res.json({ status: true, data: tickets });
    } catch (err) {
      if (err) throw err;
    }
  },

  async viewTicketOne(req, res) {
    try {
      const tickets = await Ticket.findById(req.params.id)
        .populate({ path: "userId", select: "email first_name" })
        .populate("subject")
        .exec();
      return res.json({ status: true, data: tickets });
    } catch (err) {
      if (err) throw err;
    }
  },

  async replayTicket(req, res) {
    const data = req.body;
    const AdminId = res.locals.admin_id;
    let io = socketHelper.GetSocket();

    let datas = {};
    try {
      let ticketInfo = await Ticket.findById(data.ticketId).exec();

      if (ticketInfo) {

        if (data.attachment != "") {
          datas = {
            chattingHistory: {
              userId: AdminId,
              message: data.ticketChat,
              userType: "admin",
              chattingImage: data.attachment,
              readByUser: false,
            },
          };
        } else {
          datas = {
            chattingHistory: {
              userId: AdminId,
              message: data.ticketChat,
              userType: "admin",
              chattingImage: "",
              readByUser: false,
            },
          };
        }

        let result = await Ticket.findOneAndUpdate(
          { _id: data.ticketId },
          { $addToSet: { chatHistory: datas.chattingHistory } }
        );
        const userId = await Ticket.findById(data.ticketId).lean();
        const tickets = await Ticket.find()
          .where({ userId: userId.userId })
          .populate({ path: "userId", select: "email first_name" })
          .populate("subject")
          .sort({ _id: -1 })
          .exec();

        const unreadCount = userId.chatHistory.filter(
          (chat) => chat.userType === "admin" && chat.readByUser === false
        ).length;

        if (result) {
          const findEmail = await Users.findOne({ _id: userId.userId });
          if (findEmail != "") {
            let email = findEmail.email;
            const datas = fs.readFileSync(supportTicMail, "utf8");
            let bodyData = datas.toString();
            const getSitesetting = await siteSetting.findOne({});
            const emailCotent = `Admin Send a message , TicketId : ${ticketInfo.ticketId}`;
            const logoPosition = getSitesetting?.logoPosition || "center";
            const copyright =
              getSitesetting?.copyright ||
              "© 2025 Rempic. All rights reserved.";
            const chars = {
              "{{logoPosition}}": logoPosition,
              "{{compName}}": copyright,
              "{{compImage}}": `${Config.Cloudinary_logo}`,
              "{{EmailContent}}": emailCotent,
            };
            bodyData = bodyData.replace(/{{logoPosition}}/i, (m) => chars[m]);
            bodyData = bodyData.replace(/{{compName}}/i, (m) => chars[m]);
            bodyData = bodyData.replace(/{{compImage}}/i, (m) => chars[m]);
            bodyData = bodyData.replace(/{{EmailContent}}/i, (m) => chars[m]);
            let subject = "Support Ticket";
            PassMailSend(email, subject, bodyData);

            const notificationres = await Notification.create({
              notificationType: "supportTicket",
              title: "Support Ticket",
              message:
                "You have a new message from the Admin on Ticket : " +
                ticketInfo.ticketId,
              // userId: userId.userId,
              userList: [
                {
                  usersId: userId.userId,
                  readStatus: 0,
                  status: 1,
                  clearStatus: 0,
                },
              ],
            });

            io.emit("chattingTicketResponse", {
              chatHistory: datas.chattingHistory,
              ticketId: data.ticketId,
              userHistory: tickets,
              unreadCount
            });

            // io.emit("notification", { notificationres });
            io.to(userId.userId.toString()).emit("notification", {
              notificationres,
            });

            const encryptedResponse = encryptData({
              status: true,
              message: "Successfully!",
              history: tickets,
            });

            return res.send({ encryptedData: encryptedResponse });
          }
        } else {
          res.send({ status: false, message: "Something went wrong!" });
        }
      }
    } catch (err) {
      if (err) throw err;
    }
  },

  async closeTicket(req, res) {   
    const data = req.body;
    let admin_id = res.locals.admin_id;
    let io = socketHelper.GetSocket();

    try {
      const adminId = await Admin.findOne({ _id: admin_id });
      const ticketData = await Ticket.findOne({ _id: data.ticketId });
      const UserData = await UserDb.findOne({ _id: ticketData.userId });
      if (adminId) {
        const result = await Ticket.findOneAndUpdate(
          { _id: data.ticketId },
          { $set: { status: data.status } },
          { new: true }
        );
        
        if (result) {
          if (data.status == 0) {
            const findEmail = await Users.findOne({ _id: ticketData.userId });

            if (findEmail != "") {
              let email = findEmail.email;
              const dataFile = fs.readFileSync(closeTicket, "utf8");
              let bodyData = dataFile.toString();
              const getSitesetting = await siteSetting.findOne({});
              const userName = findEmail.first_name || "";
              const ticketId = ticketData.ticketId;
              const logoPosition = getSitesetting?.logoPosition || "center";
              const copyright =
                getSitesetting?.copyright ||
                "© 2025 Rempic. All rights reserved.";
              const chars = {
                "{{logoPosition}}": logoPosition,
                "{{compName}}": copyright,
                "{{compImage}}": `${Config.Cloudinary_logo}`,
                "{{UserName}}": userName,
                "{{TicketId}}": ticketId,
                "{{link}}": `${Config.Frontend_URL}/support`,
              };

              for (const key in chars) {
                const regex = new RegExp(key, "g"); // use global match
                bodyData = bodyData.replace(regex, chars[key]);
              }

              let subject = `Your Support Ticket ${ticketId} has been successfully closed`;
              PassMailSend(email, subject, bodyData);


              const notificationres = await Notification.create({
                notificationType: "supportTicket",
                title: "Support Ticket",
                message:
                  `Your support ticket ${ticketId} has been successfully closed.`,
                // userId: userId.userId,
                userList: [
                  {
                    usersId: ticketData.userId,
                    readStatus: 0,
                    status: 1,
                    clearStatus: 0,
                  },
                ],
              });

              io.to(ticketData.userId.toString()).emit("notification", {
                notificationres,
              });


              const encryptedResponse = encryptData({
                status: true,
                data: "Ticket Closed",
              });
              let TicketOpenAdminActivity;
              if (encryptedResponse) {
                if (adminId.admin_type == "SuperAdmin") {

                  TicketOpenAdminActivity = await adminActivity(
                    req,
                    data.ip,
                    "Support Ticket",
                    adminId.email,
                    adminId.admin_type,
                    UserData.email,
                    `${UserData.email}'s ticket Closed successfully.`
                  );
                } else {
                  TicketOpenAdminActivity = await adminActivity(
                    req,
                    data.ip,
                    "Support Ticket",
                    adminId.email,
                    adminId.adminName,
                    UserData.email,
                    `${UserData.email}'s  ticket Closed successfully.`
                  );
                }
              }
              return res.send({ encryptedData: encryptedResponse });
            }

          } else {
            // await common.adminactivtylog(req, 'Support Ticket', admin_id, adminId.email, 'Ticket Reopen By Admin', 'Ticket Reopen');
            const encryptedResponse = encryptData({
              status: true,
              data: "Ticket Opened",
            });
            let TicketCloseAdminActivity;
            if (encryptedResponse) { 
              if (adminId.admin_type == "SuperAdmin") { 
                TicketCloseAdminActivity = await adminActivity(
                  req,
                  data.ip,
                  "Support Ticket",
                  adminId.email,
                  adminId.admin_type,
                  UserData.email,
                  `${UserData.email}'s ticket Opened successfully.`
                );
              } else {
                TicketCloseAdminActivity = await adminActivity(
                  req,
                  data.ip,
                  "Support Ticket",
                  adminId.email,
                  adminId.adminName,
                  UserData.email,
                  `${UserData.email}'s  ticket Opened successfully.`
                );
              }
            }


            return res.send({ encryptedData: encryptedResponse });
            // res.json({ status: true, data: "Ticket Opened" });
          }
        } else {
          res.json({ status: false, data: "Ticket Not Closed" });
        }
      }
    } catch (err) {
      if (err) throw err;
    }
  },

  async viewIssue(req, res) {
    try {
      const datas = await IssueModel.find().exec();
      if (datas.length > 0) {
        return res.json({ status: true, data: datas });
      } else {
        return res.json({ status: true, data: [] });
      }
    } catch (err) {
      if (err) throw err;
    }
  },

  async deleteIssue(req, res) {
    try {
      await IssueModel.findByIdAndDelete(req.params.id, (err, result) => {
        if (err) throw err;
        return res.json({ status: true, data: "issue deleted" });
      }).exec();
    } catch (err) {
      if (err) throw err;
    }
  },

  async getAllTickets(req, res) {
    try {
      let matchQ = {};
      const getdata = req.query || {};

      // ===== Date Filter =====
      if (getdata.fromDate && getdata.toDate) {
        const fromDate = new Date(getdata.fromDate);
        const toDate = new Date(getdata.toDate);
        const startOfDay = new Date(fromDate.setHours(0, 0, 0, 0));
        const endOfDay = new Date(toDate.setHours(23, 59, 59, 999));

        matchQ.date = { $gte: startOfDay, $lte: endOfDay };
      }

      // ===== Type Filter =====
      if (getdata.type && getdata.type.trim() !== "All") {
        const issueMatchQ = {
          issueTitle: { $regex: getdata.type, $options: "i" },
        };
        const issues = await IssueModel.find(issueMatchQ, { _id: 1 });

        if (issues && issues.length > 0) {
          const issueIds = issues.map((i) => i._id);
          matchQ.subject = { $in: issueIds };
        } else {
          return res.json({ status: true, data: [], total: 0 });
        }
      }

      // ===== Status Filter =====
      if (getdata.status && getdata.status.trim() !== "") {
        matchQ.status = getdata.status.toLowerCase() === "active" ? 1 : 0;
      }

      // ===== Search Query (User / Ticket ID) =====
      if (getdata.search && getdata.search.trim() !== "") {
        const query = getdata.search.trim();

        if (!isNaN(query)) {
          // numeric ticketId search
          matchQ.ticketId = query;
        } else {
          const userMatchQ = {
            $or: [
              { first_name: { $regex: query, $options: "i" } },
              { email: { $regex: query, $options: "i" } },
            ],
          };

          const users = await Users.find(userMatchQ, { _id: 1 });
          if (users && users.length > 0) {
            const userIds = users.map((u) => u._id);

            matchQ.userId = { $in: userIds };
          } else {
            return res.json({ status: true, data: [], total: 0 });
          }
        }
      }

      // ===== Pagination ===== (page - 1) * limit
      const page = parseInt(getdata.page) || 1;
      const limit = parseInt(getdata.limit) || 10;
      const offset = (page - 1) * limit;

      // ===== Query DB =====
      const ticketList = await Ticket.find(matchQ)
        .sort({ _id: -1 })
        .populate({ path: "userId", select: "email first_name" })
        .populate({ path: "subject", select: "issueTitle" })
        .limit(limit)
        .skip(offset)
        .lean();

      const ticketCount = await Ticket.countDocuments(matchQ);

      return res.json({ status: true, data: ticketList, total: ticketCount });
    } catch (err) {
      console.error("Error in getAllTickets:", err);
      return res.json({
        status: false,
        message: "Something went wrong! Please try again later.",
      });
    }
  },

  async updateImages(req, res) {
    try {

      const files = req.files || [];

      if (!files || files.length === 0) {
        return res
          .status(400)
          .json({ status: false, message: "No files uploaded" });
      }

      const urls = files.map((file) => ({
        name: file.path, // or file.location if using Cloudinary/S3
      }));

      return res.json({ status: true, message: urls });
    } catch (error) {
      console.error("updateImages error:", error);
      return res.status(500).json({ status: false, message: "Server error" });
    }
  },

};

module.exports = supportTicketAdminController;
