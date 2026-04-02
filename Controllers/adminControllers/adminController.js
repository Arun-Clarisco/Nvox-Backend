const CryptoJS = require("crypto-js");
const adminUser = require("../../Modules/adminModule/AdminModule");
const Config = require("../../Config/config");
const jwt = require("jsonwebtoken");
const axios = require("axios");
const path = require("path");
const fs = require("node:fs");
const primaryConfig = Config.primarySmtp;
const nodemailer = require("nodemailer");
const hbs = require("nodemailer-express-handlebars");
const resetMailBody = path.resolve(
  __dirname,
  "../EmailTemplates/mailBody/resetPassword.txt"
);
const rejectWithdraw = path.resolve(
  __dirname,
  "../EmailTemplates/mailBody/rejectWithdraw.txt"
);
const accountmail = path.resolve(
  __dirname,
  "../EmailTemplates/mailBody/accountmail.txt"
);
const userKyc = require("../../Modules/userModule/KycVerification");
const userIndiviuals = require("../../Modules/userModule/IndividualUserForm");
const userBusiness = require("../../Modules/userModule/BussinesUserForm");
const userModule = require("../../Modules/userModule/userModule");
const adminSettings = require("../../Modules/adminModule/AdminSettings");
const Withdrawhistory = require("../../Modules/userModule/Withdrawhistory");
const userBalance = require("../../Modules/userModule/userBalance");
const pairData = require("../../Modules/userModule/pairData");
const Coinfeesetting = require("../../Modules/adminModule/Coinfeesetting");
const adminTransferHistory = require("../../Modules/adminModule/adminTransferHistory");
const { encryptData, decryptData } = require("../../Config/Security");
const Notification = require("../../Modules/userModule/notification");
const socketHelper = require("../socket/socketCommon");
const SettingData = require("../../Modules/adminModule/SiteSetting");
const TermSchema = require("../../Modules/adminModule/TermsConditionsData");
const subAdminMethods = require("../adminControllers/SubAdminController");
const userDb = require("../../Modules/userModule/userModule");
const adminResetToken = require("../../Modules/adminModule/AdminResetToken");
const siteSetting = require("../../Modules/adminModule/SiteSetting");
const { SendMailClient } = require("zeptomail");

const zepto_url = Config.ZEPTOMAIL_URL;
const zepto_token = Config.ZEPTOMAIL_TOKEN;

const mail_Client = new SendMailClient({ url: zepto_url, token: zepto_token });

function userpower(x) {
  if (Math.abs(x) < 1.0) {
    var e = parseInt(x.toString().split("e-")[1]);
    if (e) {
      x *= Math.pow(10, e - 1);
      x = "0." + new Array(e).join("0") + x.toString().substring(2);
    }
  } else {
    var e = parseInt(x.toString().split("+")[1]);
    if (e > 20) {
      e -= 20;
      x /= Math.pow(10, e);
      x += new Array(e + 1).join("0");
    }
  }
  return x;
}

function toPlainString(num) {
  if (Math.abs(num) < 1.0) {
    let e = parseInt(num.toString().split("e-")[1]);
    if (e) {
      num *= Math.pow(10, e - 1);
      return "0." + "0".repeat(e - 1) + num.toString().substring(2);
    }
  } else {
    let e = parseInt(num.toString().split("+")[1]);
    if (e > 20) {
      e -= 20;
      num /= Math.pow(10, e);
      return num.toString() + "0".repeat(e);
    }
  }
  return num.toString();
}

function addExact(a, b) {
  const aStr = toPlainString(a);
  const bStr = toPlainString(b);

  const [aInt, aDec = ""] = aStr.split(".");
  const [bInt, bDec = ""] = bStr.split(".");

  const decLength = Math.max(aDec.length, bDec.length);
  const aFull = BigInt(aInt + aDec.padEnd(decLength, "0"));
  const bFull = BigInt(bInt + bDec.padEnd(decLength, "0"));

  const sum = aFull + bFull;
  const sumStr = sum.toString().padStart(decLength + 1, "0");

  if (decLength === 0) {
    return sumStr;
  }

  const intPart = sumStr.slice(0, -decLength) || "0";
  const decPart = sumStr.slice(-decLength).replace(/0+$/, "");

  return decPart ? `${intPart}.${decPart}` : intPart;
}

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
//   try {
//     let mailOptions = {
//       from: `${Config.mailFromAddress1}`,
//       to: `${to}`,
//       subject: `${sub}`,
//       html: `${emailBody}`,
//     };
//     transporter.sendMail(mailOptions, (err, info) => {
//       if (err) {
//         console.error("Error sending email:", err);
//       } else {
//         console.log("Mail sent successfully", info.response);
//       }
//     });
//   } catch (error) {
//     console.error("Error sending email:", error);
//   }
// };

const encryptKey = (key) =>
  key ? CryptoJS.AES.encrypt(key, Config.AdminencdcrKey).toString() : "";

class AdminController {
  // create

  decryptionKey = async (key) => {
    const bytes = CryptoJS.AES.decrypt(key, Config.AdminencdcrKey);
    const originalText = bytes.toString(CryptoJS.enc.Utf8);
    return originalText;
  };

  userHistory = async (id, fromAddress, txHash, status) => {
    try {
      const updateHistory = await Withdrawhistory.findByIdAndUpdate(
        id,
        {
          $set: {
            from: fromAddress,
            txnId: txHash,
            status: status,
          },
          $setOnInsert: { createdDate: new Date() },
        },
        { new: true, upsert: true }
      );
      return updateHistory;
    } catch (error) {
      console.error("User history update error:", error);
      return null;
    }
  };

  adminHistory = async (fromAddr, toAddr, amnt, symbol, txHash) => {
    try {
      const adminData = new adminTransferHistory({
        from: fromAddr,
        toaddress: toAddr,
        amount: amnt,
        txnId: txHash,
        symbol: symbol,
      });
      const saveAdminHistory = await adminData.save();
      return saveAdminHistory;
    } catch (error) {
      console.error("Admin Transfer history update error:", error);
      return null;
    }
  };

  userDepositUpdate = async (id, amount, symbol) => {
    try {
      const userData = await userBalance.findOne({ userId: id });
      let updateBalance, updateUserBalance;
      switch (symbol.toUpperCase()) {
        case "USDT":
          updateBalance = {
            USDT_Balance: userData.USDT_Balance + amount,
          };
          break;
        case "BTC":
          updateBalance = {
            BTC_Balance: userData.BTC_Balance + amount,
          };
          break;
        case "ETH":
          updateBalance = {
            ETH_Balance: userData.ETH_Balance + amount,
          };
          break;
        case "SOL":
          updateBalance = {
            SOL_Balance: userData.SOL_Balance + amount,
          };
          break;
        case "LTC":
          updateBalance = {
            LTC_Balance: userData.LTC_Balance + amount,
          };
          break;
        case "ADA":
          updateBalance = {
            CARDONA_Balance: userData.CARDONA_Balance + amount,
          };
          break;
        default:
          return res.status(400).json({ error: "Invalid currency symbol" });
      }
      if (!userData) {
        let userBal = new userBalance({ updateBalance });
        updateUserBalance = await userBal.save();
      } else {
        updateUserBalance = await userBalance.findOneAndUpdate(
          { userId: id },
          { $set: updateBalance },
          { new: true }
        );
      }
      return updateUserBalance;
    } catch (error) {
      console.error("User history update error:", error);
      return null;
    }
  };

  rejectUserRequest = async (data, totalAmnt, req, adminId) => {
    try {
      const userData = await userBalance.findOne({ userId: data.userId });
      const adminData = await adminUser.findById({ _id: adminId }).exec();

      let updateBalance;

      switch (data.symbol.toUpperCase()) {
        case "USDT":
          updateBalance = {
            USDT_Balance: addExact(userpower(userData.USDT_Balance), totalAmnt),
          };
          break;
        case "BTC":
          updateBalance = {
            BTC_Balance: addExact(userpower(userData.BTC_Balance), totalAmnt),
          };
          break;
        case "ETH":
          updateBalance = {
            ETH_Balance: addExact(userpower(userData.ETH_Balance), totalAmnt),
          };
          break;
        case "SOL":
          updateBalance = {
            SOL_Balance: addExact(userpower(userData.SOL_Balance), totalAmnt),
          };
          break;
        case "LTC":
          updateBalance = {
            LTC_Balance: addExact(userpower(userData.LTC_Balance), totalAmnt),
          };
          break;
        case "ADA":
          updateBalance = {
            CARDONA_Balance: addExact(
              userpower(userData.CARDONA_Balance),
              totalAmnt
            ),
          };
          break;
        default:
          return console.log("Invalid currency symbol");
      }
      const rejectHistory = await Withdrawhistory.findByIdAndUpdate(
        { _id: data.id },
        { $set: { status: 0, reason: req.body.reason } },
        { new: true }
      );

      const rejectUser = await userDb.findById({ _id: rejectHistory.userId });
      const rejectBal = await userBalance.findOneAndUpdate(
        { userId: data.userId },
        { $set: updateBalance },
        { new: true }
      );
      if (adminData.admin_type == "SuperAdmin") {
        const RejectAdminActivity = await subAdminMethods.adminActivity(
          req,
          data.ip,
          "withdrawRequest",
          adminData.email,
          adminData.admin_type,
          rejectUser.email,
          `${rejectHistory.moveCur} Withdrawal request rejected successfully.!`
        );
      } else {
        const RejectAdminActivity = await subAdminMethods.adminActivity(
          req,
          data.ip,
          "withdrawRequest",
          adminData.email,
          adminData.adminName,
          rejectUser.email,
          `${rejectHistory.moveCur} Withdrawal request rejected successfully.!`
        );
      }


      const datas = fs.readFileSync(rejectWithdraw, "utf8");
      let bodyData = datas.toString();
      const getSitesetting = await siteSetting.findOne({});
      const emailCotent = `Your ${totalAmnt} ${rejectHistory.moveCur} Withdrawal request rejected!`;
      const reason = req.body.reason || "No reason provided";
      const logoPosition = getSitesetting?.logoPosition || "center";
      const copyright =
        getSitesetting?.copyright ||
        "© 2025 Rempic. All rights reserved.";
      const chars = {
        "{{logoPosition}}": logoPosition,
        "{{compName}}": copyright,
        "{{compImage}}": `${Config.Cloudinary_logo}`,
        "{{EmailContent}}": emailCotent,
        "{{Reason}}": reason,
      };
      bodyData = bodyData.replace(/{{logoPosition}}/i, (m) => chars[m]);
      bodyData = bodyData.replace(/{{compName}}/i, (m) => chars[m]);
      bodyData = bodyData.replace(/{{compImage}}/i, (m) => chars[m]);
      bodyData = bodyData.replace(/{{EmailContent}}/i, (m) => chars[m]);
      bodyData = bodyData.replace(/{{Reason}}/i, (m) => chars[m]);
      let subject = "Withdrawal Rejected";
      forgetPassMailSend(rejectUser.email, subject, bodyData);

      return true;
    } catch (error) {
      console.error("User history update error:", error);
      return null;
    }
  };

  currencyData = async (symbol) => {
    try {
      const currencyDetail = await pairData.findOne({ symbol: symbol });
      if (currencyDetail) {
        return currencyDetail;
      } else {
        return { status: false, message: `Cannot Found the ${symbol} data..` };
      }
    } catch (error) {
      console.error("Currency Data error:", error);
      return null;
    }
  };

  create = async (req, res) => {
    try {
      var password = CryptoJS.AES.encrypt(
        req.body.password,
        Config.AdminencdcrKey
      ).toString();
      const { email } = req.body;
      const data = new adminUser({
        email,
        password,
        admin_type: "SuperAdmin",
      });
      const value = await data.save();

      if (value) {
        res.status(200).send({
          status: true,
          message: "Register Successfully...",
          data: value,
        });
      } else {
        res.status(400).send({ status: false, message: "Register Failed..." });
      }
    } catch (error) {
      res
        .status(500)
        .send({ status: false, message: "Internal Server Error.." });
    }
  };

  // login
  login = async (req, res) => {
    try {
      const { email, ip } = req.body;
      var Admin = await adminUser.findOne({ email: email });

      if (Admin) {
        if (
          Admin?.admin_type == "SubAdmin" &&
          Admin?.active_status != "Active"
        ) {
          return res.send({
            status: false,
            message: "Admin Blocked..! Please contact Super Admin",
          });
        }

        let AdminDbPassword = Admin.password;
        var bytes = CryptoJS.AES.decrypt(
          AdminDbPassword,
          Config.AdminencdcrKey
        );
        var originalText = bytes.toString(CryptoJS.enc.Utf8);
        if (originalText !== req.body.password) {
          return res.send({ status: false, message: "Invalid password" });
        } else {
          const token = jwt.sign({ id: Admin._id }, Config.JWT_ADMIN_SECRET, {
            expiresIn: "24h",
          });

          if (token) {
            await adminUser.findOneAndUpdate(
              { email: req.body.email },
              {
                $set: {
                  admin_auth: token,
                },
              }
            );
            let dataval;
            if (Admin.admin_type == "SuperAdmin") {
              dataval = await subAdminMethods.adminActivity(
                req,
                ip,
                "Login",
                Admin.email,
                Admin.admin_type,
                Admin.email,
                "Login Into Admin Panel"
              );
            } else {
              dataval = await subAdminMethods.adminActivity(
                req,
                ip,
                "Login",
                Admin.email,
                Admin.adminName,
                Admin.email,
                "Login Into Admin Panel"
              );
            }

            const adminencryptedResponse = encryptData({
              status: true,
              message: "Admin Login Successfully!",
              token,
              Admin,
            });

            return res.send({ encryptedData: adminencryptedResponse });
          } else {
            res
              .status(400)
              .send({ status: false, message: "Admin Login Failed!" });
          }
        }
      } else {
        return res.send({ status: false, message: "Admin not found" });
      }
    } catch (error) {
      console.log("error--", error);
      res.status(500).send({ status: false, message: "Please Signup First.." });
    }
  };

  // Change Password
  changePassword = async (req, res) => {
    const id = res.locals.admin_id;
    const datas = req.body;
    try {
      if (!id) {
        return res
          .status(400)
          .send({ status: false, message: "Invalid Admin Login.." });
      }
      const adminData = await adminUser.findById({ _id: id });
      var bytes = CryptoJS.AES.decrypt(
        adminData.password,
        Config.AdminencdcrKey
      );
      var originalText = bytes.toString(CryptoJS.enc.Utf8);
      if (originalText == datas.oldPassword) {
        var password = CryptoJS.AES.encrypt(
          datas.newPassword,
          Config.AdminencdcrKey
        ).toString();
        const updatePass = await adminUser.findByIdAndUpdate(
          { _id: id },
          { $set: { password: password } }
        );
        if (updatePass) {
          res.status(200).send({ status: true, message: "Password Updated.." });
        } else {
          res
            .status(400)
            .send({ status: false, message: "Failed to Update Password.." });
        }
      } else {
        res.status(400).send({ status: false, message: "Invalid Password.." });
      }
    } catch (error) {
      res
        .status(500)
        .send({ status: false, message: "Internal Server Error.." });
    }
  };

  // Forget & Reset Password
  forgetpass = async (req, res) => {
    try {
      const email = req.body.email;
      let Admin = await adminUser.findOne({ email: email });
      if (Admin) {
        const data = fs.readFileSync(resetMailBody, "utf8");
        let bodyData = data.toString();
        const token = jwt.sign({ id: Admin._id }, Config.MAIL_CONFIRM_SECRET, {
          expiresIn: "5m",
        });
        const getSitesetting = await SettingData.findOne({});
        const copyright =
          getSitesetting?.copyright || "© 2025 Rempic. All rights reserved.";
        const chars = {
          "{{link}}": `${Config.AdminPanel_URl}/resetpassword/${token}`,
          "{{compName}}": copyright,
          "{{compImage}}": `${Config.Cloudinary_logo}`,
        };
        bodyData = bodyData.replace(/{{link}}/i, (m) => chars[m]);
        bodyData = bodyData.replace(/{{compName}}/i, (m) => chars[m]);
        bodyData = bodyData.replace(/{{compName}}/i, (m) => chars[m]);
        bodyData = bodyData.replace(/{{compImage}}/i, (m) => chars[m]);
        let subject = "Reset Your Password";
        forgetPassMailSend(email, subject, bodyData);
        res.send({
          status: true,
          message:
            "Please check your email Inbox and Link will expired in 5 mins ",
          Admintoken: token,
        });
      } else {
        res.send({ status: false, message: "Enter valid email address..!" });
      }
    } catch (error) {
      // console.log("error:", error);
      res.send({ status: false, message: "Something went wrong..!" });
    }
  };

  adminResetpassword = async (req, res) => {
    try {
      const { token } = req.body;

      if (!token || token === null || token === undefined) {
        return res.send({ status: false, message: "Token is required" });
      }
      const adminResetTokenused = await adminResetToken.findOne({
        adminResetToken: token,
      });

      if (adminResetTokenused) {
        return res.send({
          status: false,
          message: "This reset link has already been used",
        });
      }

      const verify = jwt.verify(token, Config.MAIL_CONFIRM_SECRET);
      const AdminId = verify.id;
      const password = CryptoJS.AES.encrypt(
        req.body.password,
        Config.AdminencdcrKey
      ).toString();
      await adminUser.findByIdAndUpdate(
        { _id: AdminId },
        { $set: { password: password } }
      );

      const admintokencreate = await adminResetToken.create({
        adminResetToken: token,
      });

      res.send({ status: true, message: "Password Updated Successfully.." });
    } catch (error) {
      console.log("err", error);
      console.log("-----------", error.TokenExpiredError);

      if (error.name === "TokenExpiredError") {
        res.send({ status: false, message: "Reset Password link is Expired" });
      } else {
        console.log(error.message, "error");
        res.json({ message: "Something went to be wrong" });
      }
    }
  };

  get_kycForm = async (req, res) => {
    const id = res.locals.admin_id;
    const datas = req.body;
    try {
      if (!id) {
        return res.send({ status: false, message: "Invalid Admin Login..." });
      }
      await userKyc
        .findOne({ user_id: datas.id })
        .sort({ _id: -1 })
        .then((resp) => {
          res.send({ status: true, message: "Get the KYC form ", resp });
        })
        .catch(() => {
          res.send({ status: false, message: "Cannot Get the KYC form" });
        });
    } catch (error) {
      res.send({ status: false, message: "Something Went Wrong.." });
    }
  };

  get_Individualform = async (req, res) => {
    const id = res.locals.admin_id;
    const datas = req.body;
    try {
      if (!id) {
        return res.send({ status: false, message: "Invalid Admin Login..." });
      }
      await userIndiviuals
        .findOne({ user_id: datas.id })
        .sort({ _id: -1 })
        .then((resp) => {
          res.send({ status: true, message: "Get the Individualform ", resp });
        })
        .catch(() => {
          res.send({ status: false, message: "Cannot Get the Individualform" });
        });
    } catch (error) {
      res.send({ status: false, message: "Something Went Wrong.." });
    }
  };

  get_Businessform = async (req, res) => {
    const id = res.locals.admin_id;
    const datas = req.body;
    try {
      if (!id) {
        return res.send({ status: false, message: "Invalid Admin Login..." });
      }
      await userBusiness
        .findOne({ user_id: datas.id })
        .sort({ _id: -1 })
        .then((resp) => {
          res.send({ status: true, message: "Get the Businessform ", resp });
        })
        .catch(() => {
          res.send({ status: false, message: "Cannot Get the Businessform" });
        });
    } catch (error) {
      res.send({ status: false, message: "Something Went Wrong.." });
    }
  };

  UserListAction = async (req, res) => {
    const id = res.locals.admin_id;
    const adminTypeData = await adminUser.findById({ _id: id });
    const supportEmail = Config.mailFromAddress1;
    let deleteBy = "";
    const UserlistId = req.body.userListID;
    const type = req.body.type;
    const ip = req.body.ip;

    if (type == "Delete") {
      deleteBy = req.body.deleteBy;
    }

    try {
      if (!id) {
        return res.send({ status: false, message: "Invalid Admin Login..." });
      }
      const userData = await userModule.findById({ _id: UserlistId });
      if (userData) {
        if (type == "Delete") {
          let socket = socketHelper.GetSocket();
          socket.emit("userLogout", {
            status: true,
            data: userData,
          });
          const value = await userModule.findByIdAndUpdate(
            { _id: UserlistId },
            {
              $set: {
                account_status: "Deleted",
                deletedDate: Date.now(),
                deletedBy: deleteBy,
              },
            },
            { new: true }
          );
          let deleteUser;
          if (adminTypeData.admin_type == "SuperAdmin") {
            deleteUser = await subAdminMethods.adminActivity(
              req,
              ip,
              "userStatusUpdate",
              adminTypeData.email,
              adminTypeData.admin_type,
              userData.email,
              `User ${userData.email}  has been Deleted`
            );
          } else {
            deleteUser = await subAdminMethods.adminActivity(
              req,
              ip,
              "userStatusUpdate",
              adminTypeData.email,
              adminTypeData.adminName,
              userData.email,
              `User ${userData.email}  has been Deleted`
            );
          }

          if (value) {
            const datas = fs.readFileSync(accountmail, "utf8");
            let bodyData = datas.toString();
            const getSitesetting = await siteSetting.findOne({});
            const userName = userData.first_name || userData.email;
            const emailCotent = `Your account has been permanently deleted. For any further clarification, please reach out to our support team at <a href="mailto:${supportEmail}">${supportEmail}</a>.`
            const logoPosition = getSitesetting?.logoPosition || "center";
            const copyright =
              getSitesetting?.copyright ||
              "© 2025 Rempic. All rights reserved.";
            const chars = {
              "{{UserName}}": userName,
              "{{logoPosition}}": logoPosition,
              "{{compName}}": copyright,
              "{{compImage}}": `${Config.Cloudinary_logo}`,
              "{{EmailContent}}": emailCotent,
            };
            bodyData = bodyData.replace(/{{UserName}}/i, (m) => chars[m]);
            bodyData = bodyData.replace(/{{logoPosition}}/i, (m) => chars[m]);
            bodyData = bodyData.replace(/{{compName}}/i, (m) => chars[m]);
            bodyData = bodyData.replace(/{{compImage}}/i, (m) => chars[m]);
            bodyData = bodyData.replace(/{{EmailContent}}/i, (m) => chars[m]);
            let subject = "Account Deleted";
            forgetPassMailSend(userData.email, subject, bodyData);

            res.send({ status: true, message: "User Data is Deleted", value });
          } else {
            res.send({ status: true, message: "User Data is Not Deleted" });
          }
        } else if (type == "Deactive") {

          const userAcc = await userModule.findByIdAndUpdate(
            { _id: UserlistId },
            {
              $set: {
                account_status: "De-Active",
              },
            }
          );
          if (userAcc) {
            let socket = socketHelper.GetSocket();
            socket.emit("userLogout", {
              status: true,
              data: userAcc,
            });
            let deactiveUser;
            if (adminTypeData.admin_type == "SuperAdmin") {
              deactiveUser = await subAdminMethods.adminActivity(
                req,
                ip,
                "userStatusUpdate",
                adminTypeData.email,
                adminTypeData.admin_type,
                userData.email,
                `User ${userData.email} has been deactivated.`
              );
            } else {
              deactiveUser = await subAdminMethods.adminActivity(
                req,
                ip,
                "userStatusUpdate",
                adminTypeData.email,
                adminTypeData.adminName,
                userData.email,
                `User ${userData.email} has been deactivated.`
              );
            }

            const datas = fs.readFileSync(accountmail, "utf8");
            let bodyData = datas.toString();
            const getSitesetting = await siteSetting.findOne({});
            const userName = userData.first_name || userData.email;
            const emailCotent = `Your account has been deactivated; please contact support if you need further assistance at <a href="mailto:${supportEmail}">${supportEmail}</a>.`;
            //Your account has been deactivated; please contact support if you need further assistance at <a href="mailto:${supportEmail}">${supportEmail}</a>.
            const logoPosition = getSitesetting?.logoPosition || "center";
            const copyright =
              getSitesetting?.copyright ||
              "© 2025 Rempic. All rights reserved.";
            const chars = {
              "{{UserName}}": userName,
              "{{logoPosition}}": logoPosition,
              "{{compName}}": copyright,
              "{{compImage}}": `${Config.Cloudinary_logo}`,
              "{{EmailContent}}": emailCotent,
            };
            bodyData = bodyData.replace(/{{UserName}}/i, (m) => chars[m]);
            bodyData = bodyData.replace(/{{logoPosition}}/i, (m) => chars[m]);
            bodyData = bodyData.replace(/{{compName}}/i, (m) => chars[m]);
            bodyData = bodyData.replace(/{{compImage}}/i, (m) => chars[m]);
            bodyData = bodyData.replace(/{{EmailContent}}/i, (m) => chars[m]);
            let subject = "Account DeActivated";
            forgetPassMailSend(userData.email, subject, bodyData);

            res.send({
              status: true,
              message: "User has been Deactivated",
              userAcc,
            });
          }
        } else {
          const userAcc = await userModule.findByIdAndUpdate(
            { _id: UserlistId },
            {
              $set: {
                account_status: "Active",
              },
            }
          );
          let ActiveUser;
          if (adminTypeData.admin_type == "SuperAdmin") {
            ActiveUser = await subAdminMethods.adminActivity(
              req,
              ip,
              "userStatusUpdate",
              adminTypeData.email,
              adminTypeData.admin_type,
              userData.email,
              `User ${userData.email} has been activated.`
            );
          } else {
            ActiveUser = await subAdminMethods.adminActivity(
              req,
              ip,
              "userStatusUpdate",
              adminTypeData.email,
              adminTypeData.adminName,
              userData.email,
              `User ${userData.email} has been activated.`
            );
          }

          if (userAcc) {
            const datas = fs.readFileSync(accountmail, "utf8");
            let bodyData = datas.toString();
            const getSitesetting = await siteSetting.findOne({});
            const userName = userData.first_name || userData.email;
            const emailCotent = "Your account has been successfully activated and is now ready for use.";
            const logoPosition = getSitesetting?.logoPosition || "center";
            const copyright =
              getSitesetting?.copyright ||
              "© 2025 Rempic. All rights reserved.";
            const chars = {
              "{{UserName}}": userName,
              "{{logoPosition}}": logoPosition,
              "{{compName}}": copyright,
              "{{compImage}}": `${Config.Cloudinary_logo}`,
              "{{EmailContent}}": emailCotent,
            };
            bodyData = bodyData.replace(/{{UserName}}/i, (m) => chars[m]);
            bodyData = bodyData.replace(/{{logoPosition}}/i, (m) => chars[m]);
            bodyData = bodyData.replace(/{{compName}}/i, (m) => chars[m]);
            bodyData = bodyData.replace(/{{compImage}}/i, (m) => chars[m]);
            bodyData = bodyData.replace(/{{EmailContent}}/i, (m) => chars[m]);
            let subject = "Account Activated";
            forgetPassMailSend(userData.email, subject, bodyData);

            res.send({
              status: true,
              message: "User has been Activated",
              userAcc,
            });
          }
        }
      }
    } catch (error) {
      console.log("error------", error);
      res.status(500).json({ status: false, message: "something went wrong" });
    }
  };

  GetFormsDetails = async (req, res) => {
    const id = res.locals.admin_id;
    try {
      if (!id) {
        return res.send({ status: false, message: "Invalid Admin Login..." });
      }
      const { FormId, type } = req.body;

      if (type == "KycDelete") {
        const kyc = await userKyc.findOne({ _id: FormId });
        const individual = await userIndiviuals.findOne({
          user_id: kyc.user_id,
        });

        const business = await userBusiness.findOne({ user_id: kyc.user_id });

        const hasIndividual =
          !!individual && Object.keys(individual).length > 0;
        const hasBusiness = !!business && Object.keys(business).length > 0;


        if (hasIndividual && hasBusiness) {
          res.send({
            status: true,
            message:
              "Deleting this KYC data will also delete the individual and  business forms.",
          });
        } else if (hasIndividual) {
          res.send({
            status: true,
            message:
              "Deleting this KYC data will also delete the individual form.",
          });
        } else {
          res.send({
            status: true,
            message: "Are you sure you want to delete this KYC data?",
          });
        }
      } else if (type == "IndividualDelete") {
        const individual = await userIndiviuals.findOne({ _id: FormId });
        const business = await userBusiness.findOne({
          user_id: individual.user_id,
        });

        const hasBusiness = !!business && Object.keys(business).length > 0;
        if (hasBusiness) {
          res.send({
            status: true,
            message:
              "Deleting this Individual data will also delete the business forms.",
          });
        } else {
          res.send({
            status: true,
            message: "Are you sure you want to delete this Individual data?",
          });
        }
      }
    } catch (error) {
      res.status(500).json({ status: false, message: "something went wrong" });
    }
  };

  FormsDelete = async (req, res) => {
    const id = res.locals.admin_id;
    const loginadminData = await adminUser.findOne({ _id: id });

    try {
      if (!id) {
        return res.send({ status: false, message: "Invalid Admin Login..." });
      }
      const { FormId, type, ip } = req.body;

      if (type == "KycDelete") {
        const kyc = await userKyc.findOne({ _id: FormId });

        const individual = await userIndiviuals.findOne({
          user_id: kyc.user_id,
        });
        const business = await userBusiness.findOne({ user_id: kyc.user_id });

        const hasIndividual =
          !!individual && Object.keys(individual).length > 0;

        const hasBusiness = !!business && Object.keys(business).length > 0;


        if (hasIndividual && hasBusiness) {

          const businessform = await userBusiness.findOneAndDelete({
            user_id: kyc.user_id,
          });
          const userIndiviualsform = await userIndiviuals.findOneAndDelete({
            user_id: kyc.user_id,
          });
          const value = await userKyc.findByIdAndDelete({ _id: FormId });

          if (loginadminData.admin_type == "SuperAdmin") {
            const threeformDelete = await subAdminMethods.adminActivity(
              req,
              ip,
              "Kyc, Individual and Business form Delete",
              loginadminData.email,
              loginadminData.admin_type,
              value.user_email,
              "Kyc, Individual and Business form data Deleted successfully"
            );
          } else {
            const threeformDelete = await subAdminMethods.adminActivity(
              req,
              ip,
              "Kyc, Individual and Business form Delete",
              loginadminData.email,
              loginadminData.adminName,
              value.user_email,
              "Kyc, Individual and Business form data Deleted successfully"
            );
          }

          const KycencryptedResponse = encryptData({
            status: true,
            message: "KYC data deleted successfully!",
            value,
          });

          if (KycencryptedResponse) {
            res.send({ data: KycencryptedResponse });
          } else {
            res.send({ status: true, message: "KycData is Not Deleted" });
          }
        }
        // .........hasIndividual  == true.........
        else if (hasIndividual) {
          const userIndiviualsData = await userIndiviuals.findOneAndDelete({
            user_id: kyc.user_id,
          });
          const value = await userKyc.findByIdAndDelete({ _id: FormId });
          if (loginadminData.admin_type == "SuperAdmin") {
            const hasIndividualDelete = await subAdminMethods.adminActivity(
              req,
              ip,
              "Kyc and Individual form Delete",
              loginadminData.email,
              loginadminData.admin_type,
              userIndiviualsData.user_email,
              "Kyc and Individual form data Deleted successfully"
            );
          } else {
            const hasIndividualDelete = await subAdminMethods.adminActivity(
              req,
              ip,
              "Kyc and Individual form Delete",
              loginadminData.email,
              loginadminData.adminName,
              userIndiviualsData.user_email,
              "Kyc and Individual form data Deleted successfully"
            );
          }
          const KycencryptedResponse = encryptData({
            status: true,
            message: "KYC data deleted successfully!",
            value,
          });
          

          if (KycencryptedResponse) {
            res.send({ data: KycencryptedResponse });
          } else {
            res.send({ status: true, message: "KycData is Not Deleted" });
          }
        }
        // ........kycOnlyDelete........
        else {

          const value = await userKyc.findByIdAndDelete({ _id: FormId });
          if (loginadminData.admin_type == "SuperAdmin") {
            const kycOnlyDelete = await subAdminMethods.adminActivity(
              req,
              ip,
              "Kyc form Delete",
              loginadminData.email,
              loginadminData.admin_type,
              value.user_email,
              "Kyc Data Deleted successfully"
            );
          } else {
            const kycOnlyDelete = await subAdminMethods.adminActivity(
              req,
              ip,
              "Kyc form Delete",
              loginadminData.email,
              loginadminData.adminName,
              value.user_email,
              "Kyc Data Deleted successfully"
            );
          }
          const KycencryptedResponse = encryptData({
            status: true,
            message: "KYC data deleted successfully!",
            value,
          });
          
          if (KycencryptedResponse) {
            res.send({ data: KycencryptedResponse });
          } else {
            res.send({ status: true, message: "KycData is Not Deleted" });
          }
        }
      }

      //................ ........IndividualDelete................................
      else if (type == "IndividualDelete") {

        const individual = await userIndiviuals.findOne({ _id: FormId });

        const business = await userBusiness.findOne({
          user_id: individual.user_id,
        });

        const hasBusiness = !!business && Object.keys(business).length > 0;

        if (hasBusiness) {
          await userBusiness.findOneAndDelete({ user_id: individual.user_id });
          const value = await userIndiviuals.findByIdAndDelete({ _id: FormId });
          if (loginadminData.admin_type == "SuperAdmin") {
            const individualAndBusiness = await subAdminMethods.adminActivity(
              req,
              ip,
              "Individual and Business form Delete",
              loginadminData.email,
              loginadminData.admin_type,
              value.user_email,
              "Individual and Business form Data Deleted successfully"
            );
          } else {
            const individualAndBusiness = await subAdminMethods.adminActivity(
              req,
              ip,
              "Individual and Business form Delete",
              loginadminData.email,
              loginadminData.adminName,
              value.user_email,
              "Individual and Business form Data Deleted successfully"
            );
          }
          const individualencryptedRes = encryptData({
            status: true,
            message: "Individual hasBusiness Data Deleted!",
            value,
          });
          
          if (individualencryptedRes) {
            res.send({
              data: individualencryptedRes,
            });
          } else {
            res.send({
              status: true,
              message: "Individual hasBusiness Data is Not Deleted",
            });
          }
        } else {
          const value = await userIndiviuals.findByIdAndDelete({ _id: FormId });
          // which admin has  delete if and else part

          if (loginadminData.admin_type == "SuperAdmin") {
            const individualOnlyDelete = await subAdminMethods.adminActivity(
              req,
              ip,
              "Individual form Delete",
              loginadminData.email,
              loginadminData.admin_type,
              value.user_email,
              "Individual form Data Deleted successfully"
            );
          } else {
            const individualOnlyDelete = await subAdminMethods.adminActivity(
              req,
              ip,
              "Individual form Delete",
              loginadminData.email,
              loginadminData.adminName,
              value.user_email,
              "Individual form Data Deleted successfully"
            );
          }
          const individualencryptedRes = encryptData({
            status: true,
            message: "Individual Data Deleted!",
            value,
          });
          
          if (individualencryptedRes) {
            res.send({
              data: individualencryptedRes,
            });
          } else {
            res.send({
              status: true,
              message: "Individual Data is Not Deleted",
            });
          }
        }
      }
      // business form delete
      else if (type == "BusinessDelete") {

        const value = await userBusiness.findByIdAndDelete({ _id: FormId });
        if (loginadminData.admin_type == "SuperAdmin") {
          const BusinessDelete = await subAdminMethods.adminActivity(
            req,
            ip,
            "Business form Delete",
            loginadminData.email,
            loginadminData.admin_type,
            value.user_email,
            "Business form Data Deleted successfully"
          );
        } else {
          const BusinessDelete = await subAdminMethods.adminActivity(
            req,
            ip,
            "Business form Delete",
            loginadminData.email,
            loginadminData.adminName,
            value.user_email,
            "Business form Data Deleted successfully"
          );
        }
        const BusinessencryptedRes = encryptData({
          status: true,
          message: "Business Data Deleted",
          value,
        });
       
        if (BusinessencryptedRes) {
          res.send({ data: BusinessencryptedRes });
        } else {
          res.send({ status: true, message: "Business Data is Not Deleted" });
        }
        
      }
    } catch (error) {
      console.log(error);
      res.status(500).json({ status: false, message: "something went wrong" });
    }
  };

    adminAddress = async (req, res) => {
    try {
      const id = res.locals.admin_id; 
      const adminTypeData = await adminUser.findById({ _id: id }); 
     


      const decrypt =
        req.body && req.body.data ? await decryptData(req.body.data) : "";

      const request = decrypt;

      const adminAddr = await adminSettings.findOne({ userId: id });
      const updates = {};
      if (request.evm_address) updates.evm_address = request.evm_address;
      if (request.evm_key) updates.evm_key = encryptKey(request.evm_key);
      if (request.btc_address) updates.btc_address = request.btc_address;
      if (request.btc_publicKey)
        updates.btc_publicKey = encryptKey(request.btc_publicKey);
      if (request.btc_seed) updates.btc_seed = encryptKey(request.btc_seed);
      if (request.sol_address) updates.sol_address = request.sol_address;
      if (request.sol_key) updates.sol_key = encryptKey(request.sol_key);
      if (request.ltc_address) updates.ltc_address = request.ltc_address;
      if (request.ltc_key) updates.ltc_key = encryptKey(request.ltc_key);
      if (request.ltc_seed) updates.ltc_seed = encryptKey(request.ltc_seed);
      if (request.ada_address) updates.ada_address = request.ada_address;
      if (request.ada_key) updates.ada_key = encryptKey(request.ada_key);

      let adminData, message;
      if (Object.keys(updates).length > 0) {
        if (!adminAddr) {
          updates.userId = id;
          const data = new adminSettings(updates);
          adminData = await data.save();

          message = "Admin Data Created"; 
          if (adminTypeData.admin_type == "SuperAdmin") {
            const adminAddressCreate = await subAdminMethods.adminActivity(
              req,
              request.ip,
              "Admin Address Create",
              adminTypeData.email,
              adminTypeData.admin_type,
              adminTypeData.email,
              "Admin Address Created successfully"
            );
          }

        } else {
          adminData = await adminSettings.findOneAndUpdate(
            { userId: id },
            { $set: updates },
            { new: true }
          );
          message = "Admin Data Updated"; 
           if (adminTypeData.admin_type == "SuperAdmin") {
            const adminAddressCreate = await subAdminMethods.adminActivity(
              req,
              request.ip,
              "Admin Address Update",
              adminTypeData.email,
              adminTypeData.admin_type,
              adminTypeData.email,
              "Admin address updated successfully"
            );
          }
          
        }
        res.send({ status: true, message, adminData });
      } else {
        if (!adminAddr) {
          message = "No data here";
          res.send({ status: false, message });
        } else {
          message = "fetch data successfully";
          adminData = adminAddr;
          res.send({ status: true, message, adminData });
        }
      }
      
    } catch (error) {
      console.error("Error in adminAddress:", error);
      res.status(500).json({ status: false, message: "Something went wrong" });
    }
  };

  adminMoveHistory = async (req, res) => {
    const id = res.locals.admin_id;
    const {
      fromDate,
      toDate,
      type,
      page = 1,
      limit = 10,
      search = "",
    } = req.query;
    try {
      if (!id) {
        return res.send({ status: false, message: "Invalid Admin Login..." });
      }

      let matchQuery = {};
      if (type) {
        matchQuery.symbol = type;
      }
      if (fromDate && toDate) {
        const to = new Date(toDate).setHours(23, 59, 59, 999);
        matchQuery.createdDate = {
          $gte: new Date(fromDate),
          $lte: new Date(to),
        };
      }

      const skip = (parseInt(page) - 1) * parseInt(limit);
      const parsedLimit = parseInt(limit);

      const pipeline = [
        { $match: matchQuery },

        // Lookup from coinaddress collection using the "from" address
        {
          $lookup: {
            from: "CoinAddress",
            localField: "from",
            foreignField: "address",
            as: "coinAddressData",
          },
        },
        {
          $unwind: {
            path: "$coinAddressData",
            preserveNullAndEmptyArrays: true,
          },
        },

        // Lookup from users collection using user_id from coinAddressData
        {
          $lookup: {
            from: "users",
            localField: "coinAddressData.user_id",
            foreignField: "_id",
            as: "userData",
          },
        },
        { $unwind: { path: "$userData", preserveNullAndEmptyArrays: true } },

        // Project to include email field in result
        {
          $project: {
            from: 1,
            toaddress: 1,
            amount: 1,
            txnId: 1,
            symbol: 1,
            createdDate: 1,
            email: "$userData.email",
          },
        },
        ...(search
          ? [
            {
              $match: {
                $or: [
                  { from: { $regex: search, $options: "i" } },
                  { txnId: { $regex: search, $options: "i" } },
                  { email: { $regex: search, $options: "i" } },
                ],
              },
            },
          ]
          : []),

        { $sort: { _id: -1 } },
        { $skip: skip },
        { $limit: parsedLimit },
      ];

      const adminData = await adminTransferHistory.aggregate(pipeline);

      const countAggregation = await adminTransferHistory.aggregate([
        { $match: matchQuery },

        {
          $lookup: {
            from: "CoinAddress",
            localField: "from",
            foreignField: "address",
            as: "coinAddressData",
          },
        },
        {
          $unwind: {
            path: "$coinAddressData",
            preserveNullAndEmptyArrays: true,
          },
        },

        {
          $lookup: {
            from: "users",
            localField: "coinAddressData.user_id",
            foreignField: "_id",
            as: "userData",
          },
        },
        { $unwind: { path: "$userData", preserveNullAndEmptyArrays: true } },

        {
          $project: {
            from: 1,
            txnId: 1,
            email: "$userData.email",
          },
        },

        ...(search
          ? [
            {
              $match: {
                $or: [
                  { from: { $regex: search, $options: "i" } },
                  { txnId: { $regex: search, $options: "i" } },
                  { email: { $regex: search, $options: "i" } },
                ],
              },
            },
          ]
          : []),

        { $count: "total" },
      ]);

      const totalRecords =
        countAggregation.length > 0 ? countAggregation[0].total : 0;

      if (!adminData || adminData.length === 0) {
        return res.send({ status: false, message: "No data found" });
      }

      res.send({
        status: true,
        data: adminData,
        pagination: {
          totalRecords,
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalRecords / parsedLimit),
        },
      });
    } catch (error) {
      res
        .status(500)
        .send({ status: false, message: "Internal Server Error.." });
    }
  };

  sendPushNotification = async (req, res) => {
    const adminId = res.locals.admin_id;
    const adminData = await adminUser.findById({ _id: adminId });

    let pushNotification = req.body;
    const notificationres = await Notification.create({
      notificationType: "admin",
      title: pushNotification.subject,
      message: pushNotification.content,
    })

      .then((response) => {
        const socket = socketHelper.GetSocket();
        socket.emit("notification", { response });
        return res.send({ status: true, message: "push notification sent" });
      })
      .catch((err) => {
        console.log(err);
      });
    if (adminData.admin_type == "SuperAdmin") {
      const NotificationadminActivity = await subAdminMethods.adminActivity(
        req,
        pushNotification.ip,
        "Notification",
        adminData.email,
        adminData.admin_type,
        adminData.email,
        "Notification Sent Successfully!"
      );
    } else {
      const NotificationadminActivity = await subAdminMethods.adminActivity(
        req,
        pushNotification.ip,
        "Notification",
        adminData.email,
        adminData.adminName,
        adminData.email,
        "Notification Sent Successfully!"
      );
    }

  };

  coinfeesetting = async (req, res) => {
    const admin_id = res.locals.admin_id;
    const { BTCUSDT, ETHUSDT, SOLUSDT, ADAUSDT, LTCUSDT, USDT } = req.body;

    if (!admin_id) {
      return res.status(400).json({ error: "User ID is required." });
    }

    try {
      const existingSetting = await Coinfeesetting.findOne({
        adminid: admin_id,
      });

      if (existingSetting) {
        // Update existing fields only if new values are provided
        existingSetting.BTCUSDT = BTCUSDT ?? existingSetting.BTCUSDT;
        existingSetting.ETHUSDT = ETHUSDT ?? existingSetting.ETHUSDT;
        existingSetting.SOLUSDT = SOLUSDT ?? existingSetting.SOLUSDT;
        existingSetting.ADAUSDT = ADAUSDT ?? existingSetting.ADAUSDT;
        existingSetting.LTCUSDT = LTCUSDT ?? existingSetting.LTCUSDT;
        existingSetting.USDT = USDT ?? existingSetting.USDT;

        await existingSetting.save();
        return res.json({
          status: true,
          message: "Settings updated successfully.",
        });
      } else {
        // Create new setting
        const newSetting = new Coinfeesetting({
          adminid: admin_id,
          BTCUSDT: BTCUSDT || 0,
          ETHUSDT: ETHUSDT || 0,
          SOLUSDT: SOLUSDT || 0,
          ADAUSDT: ADAUSDT || 0,
          LTCUSDT: LTCUSDT || 0,
          USDT: USDT || 0,
        });

        await newSetting.save();
        return res.json({
          status: true,
          message: "Settings created successfully.",
        });
      }
    } catch (error) {
      console.error("Error saving site settings:", error);
      return res.status(500).json({ error: "Internal server error." });
    }
  };

  getcoinfeesetting = async (req, res) => {
    const admin_id = res.locals.admin_id;

    if (!admin_id) {
      return res.status(400).json({ error: "User ID is required." });
    }

    try {
      const existingSetting = await Coinfeesetting.findOne({
        adminid: admin_id,
      });

      if (existingSetting) {
        return res.json({
          status: true,
          message: "Settings fetched successfully.",
          data: existingSetting,
        });
      } else {
        return res.json({ status: false, message: "Settings not found." });
      }
    } catch (error) {
      console.error("Error fetching site settings:", error);
      return res.status(500).json({ error: "Internal server error." });
    }
  };

  updateSiteSetting = async (req, res) => {
    const admin_id = res.locals.admin_id;
    const UpdateAdmin = await adminUser.findOne({ _id: admin_id });

    const {
      emailSubject,
      emailContent,
      expireTime,
      copyright,
      resendOTPexpireTime,
      logoPosition,
      ip,
    } = req.body;

    const logo = req.file ? req.file.path : null;

    if (!admin_id) {
      return res.status(400).json({ error: "User ID is required." });
    }

    try {
      const existingSetting = await SettingData.findOne({});

      if (existingSetting) {
        // Update existing fields only if new values are provided
        existingSetting.emailSubject =
          emailSubject || existingSetting.emailSubject;
        existingSetting.emailContent =
          emailContent || existingSetting.emailContent;
        existingSetting.expireTime = expireTime || existingSetting.expireTime;
        existingSetting.copyright = copyright || existingSetting.copyright;
        existingSetting.logo = logo || existingSetting.logo;
        existingSetting.resendOTPexpireTime =
          resendOTPexpireTime || existingSetting.resendOTPexpireTime;
        existingSetting.logoPosition =
          logoPosition || existingSetting.logoPosition;

        const siteSettingdata = await existingSetting.save();
        if (UpdateAdmin.admin_type == "SuperAdmin") {
          const siteSettingActivity = await subAdminMethods.adminActivity(
            req,
            ip,
            "siteSetting",
            UpdateAdmin.email,
            UpdateAdmin.admin_type,
            UpdateAdmin.email,
            "Site Setting Updated Successfully!"
          );
        } else {
          const siteSettingActivity = await subAdminMethods.adminActivity(
            req,
            ip,
            "siteSetting",
            UpdateAdmin.email,
            UpdateAdmin.adminName,
            UpdateAdmin.email,
            "Site Setting Updated Successfully!"
          );
        }

        return res.send({
          status: true,
          message: "Site settings updated successfully.",
        });
      } else {
        // Create new setting
        const newSetting = new SettingData({
          userId: admin_id,
          emailSubject: emailSubject || "",
          emailContent: emailContent || "",
          expireTime: expireTime || "",
          copyright: copyright || "",
          logo: logo || "",
          resendOTPexpireTime: resendOTPexpireTime || "",
          logoPosition: logoPosition || "center",
        });

        await newSetting.save();
        return res.send({
          status: true,
          message: "Site settings created successfully.",
        });
      }
    } catch (error) {
      console.error("Error saving site settings:", error);
      return res.status(500).json({ error: "Internal server error." });
    }
  };

  getSiteSetting = async (req, res) => {
    const admin_id = res.locals.admin_id;

    if (!admin_id) {
      return res.status(400).json({ error: "User ID is required." });
    }

    try {
      const existingSetting = await SettingData.findOne({});

      if (existingSetting) {
        return res.send({
          status: true,
          message: "Settings fetched successfully.",
          data: existingSetting,
        });
      } else {
        return res.json({
          status: false,
          message: "Settings not found.",
          data: {},
        });
      }
    } catch (error) {
      console.error("Error fetching site settings:", error);
      return res.status(500).json({ error: "Internal server error." });
    }
  };
  getCopyRightsData = async (req, res) => {
    try {
      const CopyRightsData = await SettingData.find({});
      if (CopyRightsData) {
        return res.send({
          status: true,
          data: CopyRightsData,
        });
      } else {
        return res.json({
          status: false,
          message: "Something went wrong.",
          data: {},
        });
      }
    } catch (err) {
      console.log("err", err);
      return res.status(500).json({ error: "Internal server error." });
    }
  };
  // create termc condtiotins page

  CreateTermsPage = async (req, res) => {
    try {
      const { Title, TermsContent } = req.body;
      const TermsPageData = await new TermSchema({
        Title: Title,
        TermsContent: TermsContent,
      });
      if (TermsPageData) {
        const saveData = await TermsPageData.save();

        return res.send({
          status: true,
          message: "page created successfully.",
          data: TermsPageData,
        });
      } else {
        return res.json({
          status: false,
          message: "The Data would not saved..",
          data: {},
        });
      }
    } catch (err) {
      console.log("err", err);
      return res.status(500).json({ error: "something went wrong.." });
    }
  };
  // get term and conditions page data
  getTermspageData = async (req, res) => {
    try {
      const TermsPageGetData = await TermSchema.find({});
      if (TermsPageGetData) {
        return res.send({
          status: true,
          data: TermsPageGetData,
        });
      } else {
        return res.json({ status: false, message: "No Data found", data: {} });
      }
    } catch (err) {
      console.log("err", err);
      return res.status(500).json({ error: "something went wrong.." });
    }
  };
  // edit term and conditions page data
  editTermspageData = async (req, res) => {
    try {
      const adminId = res.locals.admin_id;
      const adminData = await adminUser.findById({ _id: adminId });
      const { _id } = req.params;
      const { Title, TermsContent, ip } = req.body;
      const TermsEditData = await TermSchema.findByIdAndUpdate(
        {
          _id: _id,
        },
        {
          $set: {
            Title: Title,
            TermsContent: TermsContent,
          },
        },
        {
          new: true,
        }
      );
      if (adminData.admin_type == "SuperAdmin") {
        const editTermsAdminActivity = await subAdminMethods.adminActivity(
          req,
          ip,
          "CMS",
          adminData.email,
          adminData.admin_type,
          TermsEditData.Title,
          "Cms updated successfully"
        );
      } else {
        const editTermsAdminActivity = await subAdminMethods.adminActivity(
          req,
          ip,
          "CMS",
          adminData.email,
          adminData.adminName,
          TermsEditData.Title,
          "Cms updated successfully"
        );
      }

      if (TermsEditData) {
        return res.send({
          status: true,
          message: "page updated successfully.",
          data: TermsEditData,
        });
      } else {
        return res.json({
          status: false,
          message: "The Data would not updated..",
          data: {},
        });
      }
    } catch (err) {
      console.log("err", err);
      return res.status(500).json({ error: "something went wrong.." });
    }
  };
  // mobile app get response
}

module.exports = new AdminController();
