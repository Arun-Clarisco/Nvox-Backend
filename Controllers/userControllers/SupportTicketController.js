const mongoose = require('mongoose');
const Config = require('../../Config/config')
const IssueModel = require('../../Modules/adminModule/Issue');
const Ticket = require('../../Modules/SupportTicket');
const socketHelper = require("../socket/socketCommon");
const siteSetting = require('../../Modules/adminModule/SiteSetting');
const Users = require('../../Modules/userModule/userModule');
const path = require("path");
const fs = require("node:fs");
const nodemailer = require("nodemailer");
const hbs = require("nodemailer-express-handlebars");
const supportTicMail = path.resolve(
    __dirname,
    "../EmailTemplates/mailBody/supportTicketMail.txt"
);
const { encryptData, decryptData } = require("../../Config/Security");


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

const supportTicketController = {
    async issueList(req, res) {
        try {
            const data = await IssueModel.find();
            // console.log("issueList==",data.length);
            if (data.length > 0) {
                return res.send({ status: true, data: data })
            } else {
                return res.send({ status: false, message: "No Issue Title Found" })
            }
        } catch (err) {
            if (err) throw err;
        }
    },

    async updateImages(req, res) {
        try {
            // console.log("updateImages");

            // ✅ req.files may be array (for multiple) or object (if using fields)
            const files = req.files || [];

            if (!files || files.length === 0) {
                return res.status(400).json({ status: false, message: "No files uploaded" });
            }

            const urls = files.map(file => ({
                name: file.path,   // or file.location if using Cloudinary/S3
            }));

            return res.json({ status: true, message: urls });
        } catch (error) {
            console.error("updateImages error:", error);
            return res.status(500).json({ status: false, message: "Server error" });
        }
    },

    async createTicket(req, res) {
        try {
            const data = req.body;
            // console.log("data==", data);

            const ticket_id = Math.floor(10000000 + Math.random() * 90000000);
            const saveData = new Ticket(data);
            saveData.ticketId = ticket_id;
            saveData.images = data.chattingImage
            saveData.chatHistory = [{
                userId: data.userId,
                message: data.description,
                userType: "user",
                chattingImage: data.chattingImage
            }]
            saveData.status = 1;
            const SaveTicket = await saveData.save();

            if (SaveTicket) {
                const findEmail = await Users.findOne({ _id: data.userId });
                if (findEmail != "") {
                    let email = findEmail.email;
                    const data = fs.readFileSync(supportTicMail, "utf8");
                    let bodyData = data.toString();
                    const getSitesetting = await siteSetting.findOne({});
                    const emailCotent = `Your Issue Submited Successfully, TicketId : ${ticket_id}`;
                    const logoPosition = getSitesetting?.logoPosition || 'center';
                    const copyright =
                        getSitesetting?.copyright || "© 2025 Rempic. All rights reserved.";
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

                    const encryptedResponse = encryptData({
                        status: true, message: "Support Ticket Created Successfully!"
                    });
                    return res.json({ encryptedData: encryptedResponse })
                }
            }


        } catch (err) {
            console.log('err', err)
            if (err) throw err;
        }
    },

    async userViewTickets(req, res) {
        try {
            const UserId = req.params.id
            // console.log("UserId---",UserId);

            if (UserId) {
                const tickets = await Ticket.find().where({ userId: UserId }).populate("userId").populate("subject").sort({ _id: -1 }).lean();

                tickets.forEach(ticket => {
                    const unreadCount = ticket.chatHistory.filter(
                        ch => ch.userType === "admin" && !ch.readByUser
                    ).length;                    
                    ticket.unreadCount = unreadCount;
                });

                return res.json({ status: true, data: tickets })
            }

        } catch (err) {
            if (err) throw err;
        }
    },

    async replayTicket(req, res) {
        // console.log("replayTicket---");

        const data = req.body;
        // console.log("data", data);
        let datas = {};
        let io = socketHelper.GetSocket();

        try {
            let ticketInfo = await Ticket.findById(data.ticketId).exec();
            // console.log("ticketInfo-front--", ticketInfo);

            if (ticketInfo) {

                // console.log("io===",io);

                // let socket = common.GetSocket();
                if (data.attachment != "") {
                    datas = {
                        chattingHistory: {
                            userId: data.userId,
                            message: data.ticketChat,
                            userType: "user",
                            chattingImage: data.attachment
                        }
                    }
                } else {
                    datas = {
                        chattingHistory: {
                            userId: data.userId,
                            message: data.ticketChat,
                            userType: "user",
                            chattingImage: ""
                        }
                    }
                }
                let result = await Ticket.findByIdAndUpdate(data.ticketId, { $addToSet: { chatHistory: datas.chattingHistory } });
                const tickets = await Ticket.find().where({ userId: data.userId }).populate("userId").populate("subject").sort({ _id: -1 }).exec();

                if (result) {

                    io.emit("chattingTicketResponse", { chatHistory: datas.chattingHistory, ticketId: data.ticketId, userHistory: tickets });

                    const encryptedResponse = encryptData({
                        "status": true,
                        "message": 'Successfully!',
                        history: tickets
                    });

                    return res.send({ encryptedData: encryptedResponse });


                    // const findEmail = await Users.findOne({ _id: ticketInfo.userId });
                    // if (findEmail != "") {
                    //     let email = findEmail.email;
                    //     const data = fs.readFileSync(supportTicMail, "utf8");
                    //     let bodyData = data.toString();
                    //     const getSitesetting = await siteSetting.findOne({});
                    //     const emailCotent = `Message send to Admin, TicketId : ${ticketInfo.ticketId}`;
                    //     const logoPosition = getSitesetting?.logoPosition || 'center';
                    //     const copyright =
                    //         getSitesetting?.copyright || "© 2025 Rempic. All rights reserved.";
                    //     const chars = {
                    //         "{{logoPosition}}": logoPosition,
                    //         "{{compName}}": copyright,
                    //         "{{compImage}}": `${Config.Cloudinary_logo}`,
                    //         "{{EmailContent}}": emailCotent,
                    //     };
                    //     bodyData = bodyData.replace(/{{logoPosition}}/i, (m) => chars[m]);
                    //     bodyData = bodyData.replace(/{{compName}}/i, (m) => chars[m]);
                    //     bodyData = bodyData.replace(/{{compImage}}/i, (m) => chars[m]);
                    //     bodyData = bodyData.replace(/{{EmailContent}}/i, (m) => chars[m]);
                    //     let subject = "Support Ticket";
                    //     PassMailSend(email, subject, bodyData);

                    //     io.emit("chattingTicketResponse", { chatHistory: datas.chattingHistory, ticketId: data.ticketId, userHistory: tickets });

                    //     const encryptedResponse = encryptData({
                    //         "status": true,
                    //         "message": 'Successfully!',
                    //         history: tickets
                    //     });

                    //     return res.send({ encryptedData: encryptedResponse });
                    //     // res.json({ "status": true, "message": 'Successfully!', history: tickets });
                    // }

                } else {
                    console.log("hi")
                }
            }

        } catch (err) {
            if (err) throw err;
        }
    },


    async markUserMessagesRead(req, res) {
        try {
            const { ticketId, userId } = req.body;

            await Ticket.updateOne(
                { _id: ticketId },
                { $set: { "chatHistory.$[elem].readByUser": true } },
                {
                    arrayFilters: [
                        { "elem.userType": "admin", "elem.readByUser": false }
                    ]
                }
            );

            return res.json({ status: true, message: "Messages marked as read" });
        } catch (error) {
            console.error(error);
            res.status(500).json({ status: false, message: "Internal server error" });
        }
    }
}



module.exports = supportTicketController;