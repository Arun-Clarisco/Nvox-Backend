const CryptoJS = require("crypto-js");
const Config = require("../../Config/config")
const primaryConfig = Config.primarySmtp;
const jwt = require("jsonwebtoken");
const path = require('path');
const nodemailer = require("nodemailer");
const hbs = require("nodemailer-express-handlebars");
const fs = require('node:fs');
const userModule = require("../../Modules/userModule/userModule")
const emailOTP = path.resolve(__dirname, '../EmailTemplates/mailBody/mailOTP.txt');
const SiteSetting = require("../../Modules/adminModule/SiteSetting");
const mongoose = require('mongoose');
const { SendMailClient } = require("zeptomail");

const zepto_url = Config.ZEPTOMAIL_URL;
const zepto_token = Config.ZEPTOMAIL_TOKEN;

const mail_Client = new SendMailClient({ url: zepto_url, token: zepto_token });

const transporter = nodemailer.createTransport({
    host: `${Config.SMTP_Host}`,
    port: 587,
    secure: false, //ssl
    auth: {
        user: `${Config.mailCredUserName}`,
        pass: `${Config.mailCredPassword}`
    }
});
const viewPath = path.resolve(__dirname, '../EmailTemplates');
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

const forgetPassMailSend = async (to, subject, emailBody) => {
  try {
    const mailOptions = {
      from: {
        address: primaryConfig.smtpDetails.email, // must be verified in ZeptoMail
        name: "noreply"
      },
      to: [
        {
          email_address: {
            address: to,
            name: to.split("@")[0]
          }
        }
      ],
      subject: subject,
      htmlbody: emailBody
    };

    await mail_Client.sendMail(mailOptions);

    console.log("✅ Mail sent successfully");
  } catch (error) {
    console.error("❌ Error sending email:", error);
  }
};

// const forgetPassMailSend = (to, sub, emailBody) => {
//     try {
//         let mailOptions = {
//             from: `${Config.mailFromAddress1}`,
//             to: `${to}`,
//             subject: `${sub}`,
//             html: `${emailBody}`,
//         };
//         transporter.sendMail(mailOptions, (err, info) => {
//             if (err) {
//                 console.error("Error sending email:", err);
//             } else {
//                 console.log('Mail sent successfully');
//             }
//         });
//     } catch (error) {
//         console.error("Error sending email:", error);
//     }
// }


class mobileRoute {
    forgotPassword = async (req, res) => {
        const { email } = req.body
        try {
            const userEmail = await userModule.findOne({ email: email });
            const name = email.split("@")[0];
            if (!userEmail) {
                return res.send({ status: false, message: "Invalid Email.." })
            }
            const getSitesetting = await SiteSetting.findOne({});
            const OTP = Math.floor(100000 + Math.random() * 900000);
            const expireTimeInMinutes = 2;
            const emailContent = 'Use the OTP to complete your verification. Do not share it with anyone.';
            const copyright = getSitesetting?.copyright || "© 2025 Rempic. All rights reserved.";
            const token = jwt.sign({ verifyOTP: OTP, userEmail }, Config.MAIL_CONFIRM_SECRET, { expiresIn: `${expireTimeInMinutes}m` });
            const logoPosition = getSitesetting?.logoPosition || 'center';
            const userName = name || "User";

            const data = fs.readFileSync(emailOTP, 'utf8');
            let bodyData = data.toString();
            const formattedEmailContent = emailContent.replace(/\n/g, "<br/>");

            const placeholders = {
                "{{validOTP}}": OTP,
                "{{ExpTime}}": expireTimeInMinutes,
                "{{compName}}": copyright,
                "{{compImage}}": `${Config.Cloudinary_logo}`,
                "{{EmailContent}}": formattedEmailContent,
                "{{logoPosition}}": logoPosition,
                "{{userName}}": userName
            };
            bodyData = bodyData.replace(/{{validOTP}}/g, placeholders["{{validOTP}}"]);
            bodyData = bodyData.replace(/{{ExpTime}}/g, placeholders["{{ExpTime}}"]);
            bodyData = bodyData.replace(/{{compName}}/g, placeholders["{{compName}}"]);
            bodyData = bodyData.replace(/{{compImage}}/g, placeholders["{{compImage}}"]);
            bodyData = bodyData.replace(/{{EmailContent}}/g, placeholders["{{EmailContent}}"]);
            bodyData = bodyData.replace(/{{logoPosition}}/g, placeholders["{{logoPosition}}"]);
            bodyData = bodyData.replace(/{{userName}}/g, placeholders["{{userName}}"]);

            const subject = "Forgot Password";
            await forgetPassMailSend(email, subject, bodyData);

            return res.send({ status: true, message: "OTP Sent", token });
        } catch (error) {
            return res.status(500).send({ status: false, message: "Internal Error..." });
        }
    }

    resendMobileOTP = async (req, res) => {
        const { data } = req.body;
        // console.log(data, req.body)
        try {
            const userEmail = await userModule.findOne({ email: data.email });
            const name = data.email.split("@")[0];
            const getSitesetting = await SiteSetting.findOne({});
            const OTP = Math.floor(100000 + Math.random() * 900000);
            const expireTimeInMinutes = getSitesetting?.resendOTPexpireTime || 2;
            const emailContent = 'Use the OTP to complete your verification. Do not share it with anyone.';
            const copyright = getSitesetting?.copyright || "© 2025 Rempic. All rights reserved.";
            const logoPosition = getSitesetting?.logoPosition || 'center';
            const userName = name || "User";


            const newToken = jwt.sign({
                verifyOTP: OTP,
                email: data.email
            }, Config.MAIL_CONFIRM_SECRET, { expiresIn: `${expireTimeInMinutes}m` });

            const datas = fs.readFileSync(emailOTP, 'utf8');
            let bodyData = datas.toString();
            const formattedEmailContent = emailContent.replace(/\n/g, "<br/>");

            const placeholders = {
                "{{validOTP}}": OTP,
                "{{ExpTime}}": expireTimeInMinutes,
                "{{compName}}": copyright,
                "{{compImage}}": `${Config.Cloudinary_logo}`,
                "{{EmailContent}}": formattedEmailContent,
                "{{logoPosition}}": logoPosition,
                "{{userName}}": userName,
            };
            bodyData = bodyData.replace(/{{validOTP}}/g, placeholders["{{validOTP}}"]);
            bodyData = bodyData.replace(/{{ExpTime}}/g, placeholders["{{ExpTime}}"]);
            bodyData = bodyData.replace(/{{compName}}/g, placeholders["{{compName}}"]);
            bodyData = bodyData.replace(/{{compImage}}/g, placeholders["{{compImage}}"]);
            bodyData = bodyData.replace(/{{EmailContent}}/g, placeholders["{{EmailContent}}"]);
            bodyData = bodyData.replace(/{{logoPosition}}/g, placeholders["{{logoPosition}}"]);
            bodyData = bodyData.replace(/{{userName}}/g, placeholders["{{userName}}"]);

            const subject = "Resend Forgot Password Mail OTP";
            await forgetPassMailSend(data.email, subject, bodyData);

            return res.send({ status: true, message: "A new OTP has been sent to your mail", token: newToken });

        } catch (error) {
            console.log('error---', error);
            res.status(500).send({ status: false, message: "Internal Server Error" });
        }
    };

    verifyForgotOTP = async (req, res) => {
        const { mailToken, verifyOTP } = req.body;
        try {
            if (verifyOTP == "") {
                return res.send({ status: false, message: "Enter Your Mail OTP!" });
            }

            const decodedToken = jwt.verify(mailToken, Config.MAIL_CONFIRM_SECRET);

            if (decodedToken.verifyOTP != verifyOTP) {
                return res.send({ status: false, message: "Invalid OTP!" });
            }

            return res.send({ status: true, message: "OTP Verrified Successfully", decodedToken });

        } catch (err) {
            if (err.name === 'TokenExpiredError') {
                const decodedToken = jwt.decode(mailToken);
                if (decodedToken.verifyOTP == verifyOTP) {
                    return res.send({ status: false, message: "This OTP has Expired" });
                } else {
                    return res.send({ status: false, message: "Invalid OTP!" });
                }
            }

            return res.send({ status: false, message: "Invalid OTP" });
        }
    };

    resetPassword = async (req, res) => {
        const { userID } = req.body
        try {
            const password = CryptoJS.AES.encrypt(req.body.password, Config.userEncrypt).toString();
            await userModule.findByIdAndUpdate({ _id: userID, }, { $set: { password: password } })
                .then(() => {
                    res.send({ status: true, message: "Password Updated Successfully.." });
                }).catch((error) => {
                    res.send({ status: false, message: "Cannot update the Password.." });
                })
        } catch (error) {
            return res.status(500).send({ status: false, message: "Internal Error..." });
        }
    }


    MobileLogOut = async (req, res) => {
        try {
            let resData = {};
            if (!req.headers.authorization) {
                resData = { status: false, message: "unauthorized" };
            } else {
                let token = req.headers.authorization.split(" ")[1];
                if (token == "null") {
                    resData = { status: false, message: "unauthorized" };
                } else {
                    let payload = jwt.verify(token, Config.JWT_USER_SECRET);
                    // console.log(payload,"payload>>>")
                    if (!payload) {
                        resData = { status: false, message: "unauthorized" };
                    } else {
                        let userData = await userModule.findOne({ _id: new mongoose.Types.ObjectId(payload.id) });
                        // console.log(userData,"userData")
                        if (userData.account_status == "Active") {
                            if (userData.user_auth == token) {
                                resData = { status: true, message: "Valid User" };
                            } else {
                                resData = { status: false, message: "unauthorized User" };
                            }
                        } else {
                            resData = { status: false, message: "unauthorized" };
                        };
                    };
                };
            };
            const data = resData;
            return res.send(data);
        } catch (error) {
            console.log('error', error)
            return res.send({ status: false, message: "Something Went Wrong!!" })
        }
    };
}

module.exports = new mobileRoute