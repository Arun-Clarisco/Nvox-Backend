const CryptoJS = require("crypto-js");
const Config = require("../../Config/config");
const jwt = require("jsonwebtoken");
const userModule = require("../../Modules/userModule/userModule");
const kycUserData = require("../../Modules/userModule/KycVerification");
const userIndiviuals = require("../../Modules/userModule/IndividualUserForm");
const bussinessUser = require("../../Modules/userModule/BussinesUserForm");
const path = require("path");
const fs = require("node:fs");
const nodemailer = require("nodemailer");
const hbs = require("nodemailer-express-handlebars");
const resetMailBody = path.resolve(
  __dirname,
  "../EmailTemplates/mailBody/resetPassword.txt"
);
const emailOTP = path.resolve(
  __dirname,
  "../EmailTemplates/mailBody/mailOTP.txt"
);
const axios = require("axios");
const twilio = require("twilio");
const client = twilio(Config.Account_SID, Config.Auth_Token);
const { encryptData, decryptData } = require("../../Config/Security");
const {
  TrustProductsEntityAssignmentsContextImpl,
} = require("twilio/lib/rest/trusthub/v1/trustProducts/trustProductsEntityAssignments");
const SiteSetting = require("../../Modules/adminModule/SiteSetting");
const socketHelper = require("../socket/socketCommon");
const { activeSession, pendingSession, userSocketMap } = require("../../Auth/userAuth");
const SignUpVerifyPhone = require("../../Modules/userModule/PhoneVerification");
const UsedToken = require("../../Modules/userModule/UsedToken");

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

const forgetPassMailSend = (to, sub, emailBody) => {
  try {
    let mailOptions = {
      from: `${Config.mailFromAddress1}`,
      to: `${to}`,
      subject: `${sub}`,
      html: `${emailBody}`,
    };
    // console.log("mailOptions--", mailOptions);

    transporter.sendMail(mailOptions, (err, info) => {
      if (err) {
        console.error("Error sending email:", err);
      } else {
        console.log("Mail sent successfully");
      }
    });
  } catch (error) {
    console.error("Error sending email:", error);
  }
};

// const mailVerifiedStatus = async (req, res) => {
//     try {
//       const { token } = req.body;
//       let tokenStatus = jwt.verify(token, Config.MAIL_CONFIRM_SECRET)
//       let user = await userModule.findOneAndUpdate({ _id: tokenStatus.userId }, {
//         $set: {
//           emailVerifyStatus: 1
//         }
//       })
//       res.send({ status: true, message: "Mail verified..." });
//     } catch (error) {
//       if (error.name === 'TokenExpiredError') {
//         res.send({ status: false, message: "Mail expired" });
//       } else {
//         console.log("Token verification failed:", error.message);
//         res.send({ status: false, message: "Something went wrong..!" });
//       }
//     }
//   }

class login_register {
  // Register
  user_Register = async (req, res) => {
    const { first_name, last_name, email, password, referral_id } = req.body;
    try {
      if (!first_name || !last_name || !email || !password) {
        return res.send({
          status: false,
          message: "First name, last name, email and password are required.",
        });
      }
      const existingEmail = await userModule.findOne({ email: email });
      const getSitesetting = await SiteSetting.findOne({});
        const name = email.split("@")[0];
        console.log("getSitesetting", getSitesetting);
        // return; 

      const expireTimeInMinutes = getSitesetting?.expireTime || 5;
      const emailContent =
        getSitesetting?.emailContent || "This is your Mail Verification OTP";
         console.log("emailContent", emailContent); 
      const copyright =
        getSitesetting?.copyright || "© 2025 Rempic. All rights reserved.";
      const logo = getSitesetting?.logo || Config.Cloudinary_logo;
      const emailSubject = getSitesetting?.emailSubject || "Email Verification";
      console.log("emailSubject", emailSubject);   

      const logoPosition = getSitesetting?.logoPosition || 'center';

      const userName = name || "User"; 
      console.log("userName", userName);   
      //return; 

    //  const lastLine = getSitesetting?.lastLine || "";

      if (existingEmail) {
        return res.send({ status: false, message: "Email Already Exists.." });
      }

      const OTP = Math.floor(100000 + Math.random() * 900000);
      // console.log("OTPregis", OTP);

      const token = jwt.sign(
        { verifyOTP: OTP, first_name, last_name, email, password, referral_id },
        Config.MAIL_CONFIRM_SECRET,
        { expiresIn: `${expireTimeInMinutes}m` }
      );

      const Token = jwt.verify(token, Config.MAIL_CONFIRM_SECRET);
      // console.log(Token.exp, "initialToken.exp");
      // console.log(Token.iat, "initialToken.iat");

      const data = fs.readFileSync(emailOTP, "utf8");
      let bodyData = data.toString();
      const formattedEmailContent = emailContent.replace(/\n/g, "<br/>");

      const placeholders = {
        "{{validOTP}}": OTP,
        "{{EmailContent}}": formattedEmailContent,
        "{{ExpTime}}": expireTimeInMinutes,
        "{{compName}}": copyright,
        "{{compImage}}": logo,
        "{{logoPosition}}": logoPosition,
        "{{userName}}": userName,
        // "{{lastLine}}": lastLine
      };
      bodyData = bodyData.replace(
        /{{validOTP}}/g,
        placeholders["{{validOTP}}"]
      );
      bodyData = bodyData.replace(
        /{{EmailContent}}/g,
        placeholders["{{EmailContent}}"]
      );
      bodyData = bodyData.replace(/{{ExpTime}}/g, placeholders["{{ExpTime}}"]);
      bodyData = bodyData.replace(
        /{{compName}}/g,
        placeholders["{{compName}}"]
      );
      bodyData = bodyData.replace(
        /{{compImage}}/g,
        placeholders["{{compImage}}"]
      );
      bodyData = bodyData.replace(
        /{{logoPosition}}/g,
        placeholders["{{logoPosition}}"]
      );
        bodyData = bodyData.replace(
         /{{userName}}/g,
         placeholders["{{userName}}"]
      );
      
      // bodyData = bodyData.replace(
      //   /{{lastLine}}/g,
      //   placeholders["{{lastLine}}"]
      // );

      const subject = emailSubject;
      forgetPassMailSend(email, subject, bodyData);

      const encryptedResponse = encryptData({
        status: true,
        message: "OTP sent to your email for verification!",
        token,
      });
      return res.send({ encryptedData: encryptedResponse });
      // return res.send({ status: true, message: "OTP sent to your email for verification", token });
    } catch (error) { 
      console.log("error---", error); 
      return res
        .status(500)
        .send({ status: false, message: "Internal Error..." });
    }
  };

  // Verify Register OTP
  verifyRegisterOTP = async (req, res) => {
    const { RegisterToken, verifyOTP, type } = req.body;
    try {
      if (verifyOTP === "") {
        return res.send({ status: false, message: "Enter Your Mail OTP!" });
      }
      const decodedToken = jwt.verify(
        RegisterToken,
        Config.MAIL_CONFIRM_SECRET
      );
      if (!decodedToken) {
        return res.send({ status: false, message: "Invalid OTP!" });
      }
      if (decodedToken.verifyOTP != verifyOTP) {
        return res.send({ status: false, message: "Invalid OTP!" });
      }

      const currentTimestamp = Math.floor(Date.now() / 1000);
      // console.log(currentTimestamp, "currentTimestamp");
      // console.log(decodedToken.exp, "decodedToken.exp");
      // console.log(decodedToken.iat, "decodedToken.iat");

      if (currentTimestamp > decodedToken.exp) {
        return res.send({
          status: false,
          message: "OTP has expired. Please request a new one.",
        });
      }

      // Encrypt the password and register the user
      const password = CryptoJS.AES.encrypt(
        decodedToken.password,
        Config.userEncrypt
      ).toString();
      const userData = new userModule({
        first_name: decodedToken.first_name,
        last_name: decodedToken.last_name,
        email: decodedToken.email,
        password: password,
        referral_id: decodedToken.referral_id,
        account_status: "Active",
        registerType: type,
      });

      const registerUser = await userData.save();
      if (!registerUser) {
        return res.send({ status: false, message: "Registration Failed.." });
      }

      return res.send({ status: true, message: "Registered Successfully" });
    } catch (error) {
      if (error.name === "TokenExpiredError") {
        res.send({ status: false, message: "OTP Expired " });
      } else {
        console.log(error.message, "error");
        res.json({ message: "Something went to be wrong" });
      }
    }
  };

  // Resend Mail OTP
  resendMailOTP = async (req, res) => {
    const data = req.body;
    // console.log(req.body, " req.body");

    try {
      const getSitesetting = await SiteSetting.findOne({});
      // console.log("getSitesetting", getSitesetting);

      // const expireTimeInMinutes = getSitesetting?.expireTime || 5;
      const resendOTPExpireTimeInMinutes =
        getSitesetting?.resendOTPexpireTime || 2;

      const emailContent =
        getSitesetting?.emailContent || "This is your Mail Verification OTP";
      const copyright =
        getSitesetting?.copyright || "© 2025 Rempic. All rights reserved.";
      const logo = getSitesetting?.logo || Config.Cloudinary_logo;
      const emailSubject = getSitesetting?.emailSubject || "Email Verification";
      const logoPosition = getSitesetting?.logoPosition || 'center';
      const lastLine = getSitesetting?.lastLine || "";

      const OTP = Math.floor(100000 + Math.random() * 900000);

      const newToken = jwt.sign(
        {
          verifyOTP: OTP,
          first_name: data.first_name,
          last_name: data.last_name,
          email: data.email,
          password: data.password,
          referral_id: data.referral_id,
        },
        Config.MAIL_CONFIRM_SECRET,
        { expiresIn: `${resendOTPExpireTimeInMinutes}m` }
      );

      const datas = fs.readFileSync(emailOTP, "utf8");
      let bodyData = datas.toString();

      const placeholders = {
        "{{validOTP}}": OTP,
        "{{EmailContent}}": emailContent,
        "{{ExpTime}}": resendOTPExpireTimeInMinutes,
        "{{compName}}": copyright,
        "{{compImage}}": logo,
        "{{logoPosition}}": logoPosition,
        "{{lastLine}}": lastLine
      };
      bodyData = bodyData.replace(
        /{{validOTP}}/g,
        placeholders["{{validOTP}}"]
      );
      bodyData = bodyData.replace(
        /{{EmailContent}}/g,
        placeholders["{{EmailContent}}"]
      );
      bodyData = bodyData.replace(/{{ExpTime}}/g, placeholders["{{ExpTime}}"]);
      bodyData = bodyData.replace(
        /{{compName}}/g,
        placeholders["{{compName}}"]
      );
      bodyData = bodyData.replace(
        /{{compImage}}/g,
        placeholders["{{compImage}}"]
      );
      bodyData = bodyData.replace(
        /{{logoPosition}}/g,
        placeholders["{{logoPosition}}"]
      );
      bodyData = bodyData.replace(
        /{{lastLine}}/g,
        placeholders["{{lastLine}}"]
      );

      const subject = emailSubject;
      forgetPassMailSend(data.email, subject, bodyData);

      return res.send({
        status: true,
        message: "A new OTP has been sent to your mail",
        token: newToken,
      });
    } catch (error) {
      console.log("error---", error);
      res.status(500).send({ status: false, message: "Internal Server Error" });
    }
  };

  // Login
  // user_Login = async (req, res) => {
  //   try {

  //     const user = await userModule
  //       .findOne({ email: req.body.email })
  //       .hint({ _id: 1 });
  //     // console.log("user>>>", user);

  //     if (user) {
  //       const findKYCUser = await kycUserData.findOne({ user_id: user._id });
  //       let userDbPassword = user.password;
  //       var bytes = CryptoJS.AES.decrypt(userDbPassword, Config.userEncrypt);
  //       var originalText = bytes.toString(CryptoJS.enc.Utf8);
  //       if (originalText !== req.body.password) {
  //         return res.send({
  //           status: false,
  //           message: "You have entered incorrect password.",
  //         });
  //       } else if (user.account_status == "De-Active") {
  //         return res.send({
  //           status: false,
  //           message: "Your Account has been Deactivated",
  //         });
  //       } else if (user.account_status == "Deleted") {
  //         return res.send({
  //           status: false,
  //           message: "Your Account has been Deleted",
  //         });
  //       } else if (findKYCUser?.sdk_verification.reviewRejectType == "FINAL") {
  //         return res.send({
  //           status: false,
  //           message: "Your Account has been Blocked",
  //         });
  //       } else {
  //         const existingSession = activeSession.get(req.body.email);
  //         // console.log(existingSession,"existingsession>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>")
  //         if (existingSession && existingSession.email == req.body.email) {
  //           // console.log(`Logging out previous user: ${existingSession.email}`);

  //           await userModule.findOneAndUpdate(
  //             { email: existingSession.email },
  //             {
  //               $set: { user_auth: "" },
  //             }
  //           );
  //           let socket = socketHelper.GetSocket();

  //           const socketId = userSocketMap.get(req.body.email);
  //           // console.log(socketId,"socketId>>>>>>>>>>>>>>>>")
  //           if (socketId) {
  //             socket.to(socketId).emit("forceLogout", {
  //               reason: "You have been logged out due to a new login.",
  //             });
  //             // console.log(`Sent forceLogout to ${req.body.email}`);
  //           }
  //           activeSession.delete(req.body.email);
  //         }

  //         const token = jwt.sign({ id: user._id }, Config.JWT_USER_SECRET, {
  //           expiresIn: "12h",
  //         });
  //         if (token) {
  //           await userModule.findOneAndUpdate(
  //             { email: req.body.email },
  //             {
  //               $set: {
  //                 user_auth: token,
  //               },
  //             }
  //           );
  //           activeSession.set(req.body.email, {
  //             email: req.body.email,
  //             token: token,
  //           });
  //           let encryptedResponse;
  //           if (user.TFAEnableKey !== "" || user.TFAStatus == false) {
  //             encryptedResponse = encryptData({
  //               status: true,
  //               message: "Please continue to 2FA verification",
  //               token,
  //               userData: user,
  //             });
  //           } else {
  //             encryptedResponse = encryptData({
  //               status: true,
  //               message: "Login Successfully!",
  //               token,
  //               userData: user,
  //             });
  //           }
  //           // console.log("encryptedResponse", encryptedResponse);

  //           return res.send({ encryptedData: encryptedResponse });
  //         } else {
  //           res.send({ status: false, message: "Login Failed!" });
  //         }
  //       }
  //     } else {
  //       return res.send({
  //         status: false,
  //         message: " This email is not registered with us.",
  //       });
  //     }
  //   } catch (error) {
  //     console.log("error", error);
  //     res.status(500).send({ status: false, message: "Please Signup First.." });
  //   }
  // };

  user_Login = async (req, res) => {
    try {
      const user = await userModule
        .findOne({ email: req.body.email })
        .hint({ _id: 1 });

      if (!user) {
        return res.send({
          status: false,
          message: "This email is not registered with us.",
        });
      }

      const findKYCUser = await kycUserData.findOne({ user_id: user._id });

      // Verify password
      const bytes = CryptoJS.AES.decrypt(user.password, Config.userEncrypt);
      const originalText = bytes.toString(CryptoJS.enc.Utf8);

      if (originalText !== req.body.password) {
        return res.send({
          status: false,
          message: "Incorrect password.",
        });
      }

      // Check account conditions
      if (user.account_status == "De-Active") {
        return res.send({ status: false, message: "Your Account has been Deactivated" });
      }
      if (user.account_status == "Deleted") {
        return res.send({ status: false, message: "Your Account has been Deleted" });
      }
      if (findKYCUser?.sdk_verification.reviewRejectType == "FINAL") {
        return res.send({ status: false, message: "Your Account has been Blocked" });
      }

      // =========================================================
      // CASE 1 → 2FA NOT ENABLED → LOGIN IMMEDIATELY
      // =========================================================
      if (!user.TFAEnableKey || user.TFAStatus === true) {

        const existingSession = activeSession.get(req.body.email);

        if (existingSession) {
          // Force logout old session now
          await userModule.findOneAndUpdate(
            { email: existingSession.email },
            { $set: { user_auth: "" } }
          );

          let socket = socketHelper.GetSocket();
          const socketId = userSocketMap.get(req.body.email);

          if (socketId) {
            socket.to(socketId).emit("forceLogout", {
              reason: "Logged out due to new login",
            });
          }

          activeSession.delete(req.body.email);
        }

        // Generate new JWT
        const token = jwt.sign(
          { id: user._id },
          Config.JWT_USER_SECRET,
          { expiresIn: "12h" }
        );

        await userModule.findOneAndUpdate(
          { email: req.body.email },
          { $set: { user_auth: token } }
        );

        activeSession.set(req.body.email, {
          email: req.body.email,
          token,
        });

        const encrypted = encryptData({
          status: true,
          message: "Login Successful!",
          token,
          userData: user,
        });

        return res.send({ encryptedData: encrypted });
      }

      // =========================================================
      // CASE 2 → 2FA ENABLED → REQUIRE OTP FIRST
      // =========================================================
      pendingSession.set(req.body.email, {
        email: req.body.email,
        time: Date.now(),
      });

      const encrypted = encryptData({
        status: true,
        message: "Please continue to 2FA verification",
        needOtp: true,
        userData: user,
      });

      return res.send({ encryptedData: encrypted });

    } catch (error) {
      console.log("error", error);
      return res.status(500).send({ status: false, message: "Server Error" });
    }
  };

  bussiness_form = async (req, res) => {
    const id = res.locals.user_id;
    const datas = req.body;
    // console.log('datas----', datas);
    try {
      const existingBusinessUser = await bussinessUser.findOne({ user_id: id });
      const files = req.files;
      // console.log('files', files)
      const BussinessForm = datas
        ? {
          ...datas,
        }
        : null;

      const formData = {
        user_id: id,
        user_email: datas.email,
        ...BussinessForm,
        // Documentation: Images
        Documentation: [
          {
            Memorandum_document: files.Memorandum_document
              ? files.Memorandum_document[0].path
              : null,
            Incorporation_document: files.Incorporation_document
              ? files.Incorporation_document[0].path
              : null,
            Directors_document: files.Directors_document
              ? files.Directors_document[0].path
              : null,
            goodstanding_document: files.goodstanding_document
              ? files.goodstanding_document[0].path
              : null,
            Incumbency_document: files.Incumbency_document
              ? files.Incumbency_document[0].path
              : null,
            Shareholders_document: files.Shareholders_document
              ? files.Shareholders_document[0].path
              : null,
            Legalownership_document: files.Legalownership_document
              ? files.Legalownership_document[0].path
              : null,
            Operatinglicense_document: files.Operatinglicense_document
              ? files.Operatinglicense_document[0].path
              : null,
            DeclarationofTrust_document: files.DeclarationofTrust_document
              ? files.DeclarationofTrust_document[0].path
              : null,
            TrustSettlement_document: files.TrustSettlement_document
              ? files.TrustSettlement_document[0].path
              : null,
            OnboardingForm_document: files.OnboardingForm_document
              ? files.OnboardingForm_document[0].path
              : null,
            Annualfinancial_document: files.Annualfinancial_document
              ? files.Annualfinancial_document[0].path
              : null,
            Auditedfinancial_document: files.Auditedfinancial_document
              ? files.Auditedfinancial_document[0].path
              : null,
            absenceof_document: files.absenceof_document
              ? files.absenceof_document[0].path
              : null,
            IdentityCardorPassport_document:
              files.IdentityCardorPassport_document
                ? files.IdentityCardorPassport_document[0].path
                : null,
            permanentaddress_document: files.permanentaddress_document
              ? files.permanentaddress_document[0].path
              : null,
            Accountopening_document: files.Accountopening_document
              ? files.Accountopening_document[0].path
              : null,
            AML_CTF_document: files.AML_CTF_document
              ? files.AML_CTF_document[0].path
              : null,
            signature: files.signature ? files.signature[0].path : null,
          },
        ],
      };
      // console.log('formData--', formData);
      // Create
      if (!existingBusinessUser) {
        const createFormData = new bussinessUser(formData);
        const createBussiness = await createFormData.save();
        if (createBussiness) {
          res.send({
            status: true,
            message: "Business User Created Successfully...",
          });
        } else {
          res.send({
            status: false,
            message: "Business User Failed to Create...",
          });
        }
      } else {
        res.send({ status: false, message: "Already register..." });
      }
    } catch (error) {
      console.log("error", error);
      res.send({ status: false, message: "Internal Error..." });
    }
  };

  // Mobile OTP

  phone_otp = async (req, res) => {
    // console.log(req.body, "-----------")

    const { phone, countryCode, country } = req.body;
    try {
      const existingNumb = await kycUserData.findOne({
        "phone_number.0.number": phone,
      });

      if (!req.body.type === "editphone") {
        if (existingNumb && existingNumb.phone_number[0].number === phone) {
          return res.send({
            status: false,
            message: "Phone Number is Aldready Registered...",
          });
        }
      }

      const OTP = 123456; // For testing purposes
      // const OTP = Math.floor(100000 + Math.random() * 900000);
      // const message = await client.messages.create({
      //   body: `Rempic SMS OTP is ${OTP} `,
      //   to: `${countryCode}${phone}`,
      //   from: Config.Admin_NUMB,
      // });
      // console.log('OTPPPPPPPPPPPPPPPP', OTP)

      const token = jwt.sign(
        { phone, countryCode, country, smsOtp: OTP },
        Config.MAIL_CONFIRM_SECRET,
        { expiresIn: "2m" }
      );
      // console.log('token', token)
      // console.log(message);
      // if (message.sid && token) {
      //   res.send({ status: true, message: "Otp sent successfully", token });
      // } else {
      //   res.send({ status: false, message: "Failed to Send OTP" });
      // }

      res.send({ status: true, message: "Otp sent successfully", token }); // For testing purposes
    } catch (error) {
      console.error("Error sending OTP:", error.message);

      if (error.code === 21606) {
        res.send({
          status: false,
          message: "The 'From' number is not valid for this country",
        });
      } else {
        res.send({ status: false, message: "Failed to send OTP", error });
      }
    }
  };

  register_Phone_otp = async (req, res) => {

    const { phone, countryCode, country, userEmail } = req.body;

    try {

      const existingEmail = await userModule.findOne({ email: userEmail });

      if (existingEmail) {

        if (existingEmail.account_status == "De-Active") {
          return res.send({ status: false, message: "Your Account has been Deactivated" });
        }

        if (existingEmail.account_status == "Deleted") {
          return res.send({ status: false, message: "Your Account has been Deleted" });
        }

        return res.send({ status: false, message: "Email Already Exists.." });
      }

      const existingRecord = await SignUpVerifyPhone.findOne({
        user_email: userEmail,
        "phone_number.0.number": phone,
      });

      if (existingRecord) {
        console.log("Already have record");

        return res.send({
          status: true,
          message: "Already verified. Proceed to next step.",
          skipOtp: true,
        });
      }


      const existingNumb = await SignUpVerifyPhone.findOne({
        "phone_number.0.number": phone,
      });

      if (existingNumb && existingNumb.phone_number[0].number === phone) {
        return res.send({
          status: false,
          message: "Phone Number is Already Registered...",
        });
      }

      // const OTP = Math.floor(100000 + Math.random() * 900000);
      const OTP = 123456; // For testing purposes
      // const message = await client.messages.create({
      //   body: `Rempic SMS OTP is ${OTP} `,
      //   to: `${countryCode}${phone}`,
      //   from: Config.Admin_NUMB,
      // });
      // console.log('OTPPPPPPPPPPPPPPPP', OTP)

      const token = jwt.sign(
        { phone, countryCode, country, smsOtp: OTP },
        Config.MAIL_CONFIRM_SECRET,
        { expiresIn: "2m" }
      );

      // if (message.sid && token) {
      //   res.send({ status: true, message: "Otp sent successfully", token, skipOtp: false });
      // } else {
      //   res.send({ status: false, message: "Failed to Send OTP" });
      // }

      res.send({ status: true, message: "Otp sent successfully", token, skipOtp: false }); // For testing purposes
    } catch (error) {
      console.error("Error sending OTP:", error.message);

      if (error.code === 21606) {
        res.send({
          status: false,
          message: "The 'From' number is not valid for this country",
        });
      } else {
        res.send({ status: false, message: "Failed to send OTP", error });
      }
    }
  };

  verifyPhone_otp = async (req, res) => {
    const id = res.locals.user_id;
    const { verifyToken, verifyOtp, signType } = req.body;

    // console.log("verifyOtp--", verifyOtp);

    try {
      if (!verifyOtp) {
        return res.send({ status: false, message: "Enter Your SMS OTP!" });
      }

      const verifyMail = jwt.verify(verifyToken, Config.MAIL_CONFIRM_SECRET);
      // console.log("verifyMail.smsOtp--typeof",typeof verifyMail.smsOtp,"verifyOtp--typeof",typeof verifyOtp);

      // console.log("verifyMail.smsOtp--",verifyMail.smsOtp,"verifyOtp--",verifyOtp);

      if (verifyMail.smsOtp == verifyOtp) {
        // console.log("Otp Matched");

        const user = await kycUserData.findOne({ user_id: id });
        // console.log("user--", user);

        let updateObj = {};

        if (user?.phone_number?.length > 0) {
          // console.log("Update index 0 if already exists");

          // Update index 0 if already exists
          updateObj = {
            $set: {
              "phone_number.0.country": verifyMail.country,
              "phone_number.0.country_code": verifyMail.countryCode,
              "phone_number.0.number": verifyMail.phone,
              "phone_number.0.phoneNo_verify": true,
            },
          };
        } else {
          // console.log("Insert fresh phone number entry");

          // Insert fresh phone number entry
          updateObj = {
            $set: {
              phone_number: [
                {
                  country: verifyMail.country,
                  country_code: verifyMail.countryCode,
                  number: verifyMail.phone,
                  phoneNo_verify: true,
                },
              ],
            },
          };
        }

        const updateOTP = await kycUserData.findOneAndUpdate(
          { user_id: id },
          updateObj,
          { new: true }
        );

        if (updateOTP) {
          return res.send({
            status: true,
            message: "OTP Verified successfully",
          });
        } else {
          return res.send({
            status: false,
            message: "Failed to update phone verification",
          });
        }
      } else {
        return res.send({ status: false, message: "Incorrect SMS OTP!" });
      }
    } catch (err) {
      if (err.name === "TokenExpiredError") {
        const decodedToken = jwt.decode(verifyToken);
        if (decodedToken.smsOtp === verifyOtp) {
          return res.send({ status: false, message: "This OTP has expired" });
        } else {
          return res.send({ status: false, message: "Invalid SMS OTP!" });
        }
      }
      return res.send({ status: false, message: "Invalid OTP" });
    }
  };

  verifySignUp_Phone_otp = async (req, res) => {
    const { verifyToken, verifyOTP, Email, Phone } = req.body;
    console.log({ verifyToken, verifyOTP, Email, Phone });

    try {

      if (!verifyOTP) {
        return res.send({ status: false, message: "Enter Your SMS OTP!" });
      }

      const verifyMail = jwt.verify(verifyToken, Config.MAIL_CONFIRM_SECRET);
      // console.log("verifyMail.smsOtp--typeof",typeof verifyMail.smsOtp,"verifyOtp--typeof",typeof verifyOtp);

      // console.log("verifyMail.smsOtp--",verifyMail.smsOtp,"verifyOtp--",verifyOtp);

      if (verifyMail.smsOtp == verifyOTP) {
        // console.log("Otp Matched");
        const phoneNumber = Phone[0].number;

        const user = await SignUpVerifyPhone.findOne({ user_email: Email, "phone_number.0.number": phoneNumber });
        console.log("user--", user);

        let updateObj = {};

        if (user?.phone_number?.length > 0) {
          // console.log("Update index 0 if already exists");

          // Update index 0 if already exists
          updateObj = {
            $set: {
              user_email: Email,
              "phone_number.0.country": verifyMail.country,
              "phone_number.0.country_code": verifyMail.countryCode,
              "phone_number.0.number": verifyMail.phone,
              "phone_number.0.phoneNo_verify": true,
            },
          };
        } else {
          // console.log("Insert fresh phone number entry");

          // Insert fresh phone number entry
          updateObj = {
            $set: {
              user_email: Email,
              phone_number: [
                {
                  country: verifyMail.country,
                  country_code: verifyMail.countryCode,
                  number: verifyMail.phone,
                  phoneNo_verify: true,
                },
              ],
            },
          };
        }

        const updateOTP = await SignUpVerifyPhone.findOneAndUpdate(
          { user_email: Email, "phone_number.0.number": phoneNumber },
          updateObj,
          { new: true, upsert: true }
        );


        if (updateOTP) {
          return res.send({
            status: true,
            message: "OTP Verified successfully",
          });
        } else {
          return res.send({
            status: false,
            message: "Failed to update phone verification",
          });
        }
      } else {
        return res.send({ status: false, message: "Incorrect SMS OTP!" });
      }
    } catch (err) {
      if (err.name === "TokenExpiredError") {
        const decodedToken = jwt.decode(verifyToken);
        if (decodedToken.smsOtp === verifyOTP) {
          return res.send({ status: false, message: "This OTP has expired" });
        } else {
          return res.send({ status: false, message: "Invalid SMS OTP!" });
        }
      }
      return res.send({ status: false, message: "Invalid OTP" });
    }
  };

  // verifyPhone_otp = async (req, res) => {
  //     const id = res.locals.user_id
  //     const { verifyToken, verifyOtp } = req.body;
  //     // console.log('verifyToken', verifyToken)

  //     try {
  //         if (!verifyOtp) {
  //             return res.send({ status: false, message: "Enter Your SMS OTP!" })
  //         }
  //         const verifyMail = jwt.verify(verifyToken, Config.MAIL_CONFIRM_SECRET)
  //         // console.log(verifyMail, "verifyMail");

  //         if (verifyMail.smsOtp == verifyOtp) {
  //             const updateOTP = await kycUserData.findOneAndUpdate(
  //                 { user_id: id },
  //                 {
  //                     $set: {
  //                         "phone_number.0.country": verifyMail.country,
  //                         "phone_number.0.country_code": verifyMail.countryCode,
  //                         "phone_number.0.number": verifyMail.phone,
  //                         "phone_number.0.phoneNo_verify": true
  //                     }
  //                 },
  //                 { new: true }
  //             );
  //             if (updateOTP) {
  //                 return res.send({ status: true, message: 'OTP Verified successfully' });
  //             }

  //         } else {
  //             return res.send({ status: false, message: 'Incorrect SMS OTP!' });
  //         }
  //     } catch (err) {
  //         // console.log("err---", err);
  //         if (err.name === 'TokenExpiredError') {
  //             const decodedToken = jwt.decode(verifyToken);
  //             if (decodedToken.smsOtp == verifyOtp) {
  //                 return res.send({ status: false, message: "This OTP has expired" });
  //             } else {
  //                 return res.send({ status: false, message: "Invalid SMS OTP!" });
  //             }
  //         }
  //         return res.send({ status: false, message: "Invalid OTP" });
  //     }
  // };

  // KYC_Verification
  kyc_form = async (req, res) => {
    console.log('kycData--111>>--', req.body)

    const id = res.locals.user_id;
    const kycData = req.body;

    if (!kycData) {
      return res.send({ status: false, message: "No KYC data received" });
    }

    try {
      const userDetail = await userModule.findById({ _id: id });

      const existingKyc = await kycUserData.findOne({ user_id: id });
      const existingIndividual = await userIndiviuals.findOne({ user_id: id });

      const kycFormData = {
        user_id: id,
        user_email: userDetail.email,
        ...kycData,
      };
      // const individual = {
      //   ...existingIndividual?.individuals,
      //   dob: kycData?.birth_information?.[0]?.birthday,
      //   citizenship: kycData?.KYC_document?.[0]?.citizenship
      // }
      // console.log(individual)
      // const formData = {
      //   user_id: id,
      //   user_email: userDetail.email,
      //   individuals: individual
      // };

      // const updateFormData = {
      //   individuals: individual
      // };

      // if (!existingIndividual) {
      //   const individualform = new userIndiviuals(formData);
      //   await individualform.save();
      // } else {
      //   const updateIndividual = await userIndiviuals.findOneAndUpdate(
      //     { user_id: id },
      //     { $set: updateFormData },
      //     { new: true }
      //   );
      // }

      if (!existingKyc) {
        const kycCreateform = new kycUserData(kycFormData);
        const kycDatacreate = await kycCreateform.save();

        return res.send({
          status: true,
          message: "The KYC Data Created",
          create: kycDatacreate,
        });
      } else {
        const updateKycData = await kycUserData.findOneAndUpdate(
          { user_id: id },
          { $set: kycData },
          { new: true }
        );

        return res.send({
          status: true,
          message: "The KYC Data Updated",
          update: updateKycData,
        });
      }
    } catch (error) {
      console.log(error, "error");
      res.send({ status: false, message: "Internal Error..." });
    }
  };
  kyc_form_sec = async (req, res) => {

    const id = res.locals.user_id;
    const kycData = req.body;

    if (!kycData) {
      return res.send({ status: false, message: "No KYC data received" });
    }

    try {
      const userDetail = await userModule.findById({ _id: id });

      const existingKyc = await kycUserData.findOne({ user_id: id });
      // console.log("existingKyc", existingKyc);

      const findEmailKyc = await SignUpVerifyPhone.findOne({ user_email: userDetail.email });

      const kycFormData = {
        user_id: id,
        user_email: userDetail.email,
        phone_number: findEmailKyc?.phone_number || [],
        ...kycData,
      };
      // console.log("kycFormData", kycFormData);

      if (!existingKyc) {
        const kycCreateform = new kycUserData(kycFormData);
        const kycDatacreate = await kycCreateform.save();
        // console.log("kycDataCreate", kycDatacreate);

        return res.send({
          status: true,
          message: "The KYC Data Created",
          create: kycDatacreate,
        });
      } else {

        const updateFields = {
          ...kycData,
        };

        if (findEmailKyc?.phone_number?.length > 0) {
          updateFields.phone_number = findEmailKyc.phone_number;
        }

        const updateKycData = await kycUserData.findOneAndUpdate(
          { user_id: id },
          { $set: updateFields },
          { new: true }
        );
        // const updateKycData = await kycUserData.findOneAndUpdate(
        //   { user_id: id },
        //   { $set: kycData },
        //   { new: true }
        // );
        // console.log("updateKycData", updateKycData);

        return res.send({
          status: true,
          message: "The KYC Data Updated",
          update: updateKycData,
        });
      }
    } catch (error) {
      console.log(error, "error");
      res.send({ status: false, message: "Internal Error..." });
    }
  };
  // Forget & Reset Password
  forgetpass = async (req, res) => {
    try {
      const email = req.body.email;
      const user = await userModule.findOne({ email: email });
      if (user) {
        const data = fs.readFileSync(resetMailBody, "utf8");
        let bodyData = data.toString();
        const token = jwt.sign({ id: user._id }, Config.MAIL_CONFIRM_SECRET, {
          expiresIn: "5m",
        });
        const getSitesetting = await SiteSetting.findOne({});
        const copyright =
          getSitesetting?.copyright || "© 2025 Rempic. All rights reserved.";
        const chars = {
          "{{link}}": `${Config.Frontend_URL}/resetpassword/${token}`,
          "{{compName}}": copyright,
          "{{compImage}}": `${Config.Cloudinary_logo}`,
        };
        bodyData = bodyData.replace(/{{link}}/i, (m) => chars[m]);
        bodyData = bodyData.replace(/{{compName}}/i, (m) => chars[m]);
        bodyData = bodyData.replace(/{{compName}}/i, (m) => chars[m]);
        bodyData = bodyData.replace(/{{compImage}}/i, (m) => chars[m]);
        let subject = "Forgot Password";
        forgetPassMailSend(email, subject, bodyData);
        res.send({
          status: true,
          message:
            "Please check your email Inbox and Link will expired in 5 mins ",
          usertoken: token,
        });
      } else {
        res.send({ status: false, message: "Non Registered User" });
      }
    } catch (error) {
      res.send({ status: false, message: "Something went wrong..!" });
    }
  };

  resetpass = async (req, res) => {
    try {
      const { token } = req.body;
      // console.log('token', token)
      if (!token) {
        return res.send({ status: false, message: "Token is required" });
      }

      const used = await UsedToken.findOne({ token });

      if (used) {
        return res.send({
          status: false,
          message: "This reset link has already been used",
        });
      }
      const verify = jwt.verify(token, Config.MAIL_CONFIRM_SECRET);
      const userId = verify.id;
      // console.log('userId', userId);

      const password = CryptoJS.AES.encrypt(
        req.body.password,
        Config.userEncrypt
      ).toString();
      await userModule.findByIdAndUpdate(
        { _id: userId },
        { $set: { password: password } }
      );

      await UsedToken.create({ token });

      res.send({ status: true, message: "Password Updated Successfully.." });
    } catch (error) {
      console.log("error", error);
      if (error.name === "TokenExpiredError") {
        res.send({ status: false, message: "Mail expired" });
      } else {
        res.json({ status: false, message: "Token is invalid" });
      }
    }
  };

  // resetpass = async (req, res) => {
  //     try {
  //       const { token } = req.body;

  //       // This will throw an error if expired
  //       const verify = jwt.verify(token, Config.MAIL_CONFIRM_SECRET);

  //       const userId = verify.id;
  //       const password = CryptoJS.AES.encrypt(req.body.password, Config.userEncrypt).toString();

  //       await userModule.findByIdAndUpdate(
  //         { _id: userId },
  //         { $set: { password: password } }
  //       );

  //       res.send({ status: true, message: "Password Updated Successfully.." });

  //     } catch (error) {
  //       if (error.name === 'TokenExpiredError') {
  //         res.send({ status: false, message: "Reset link has expired. Please request a new one." });
  //       } else if (error.name === 'JsonWebTokenError') {
  //         res.send({ status: false, message: "Invalid reset link." });
  //       } else {
  //         res.json({ status: false, message: "Something went wrong." });
  //       }
  //     }
  //   };

  // Register Form

  user_register_form = async (req, res) => {
    const id = res.locals.user_id;
    const datas = req.body;
    try {
      const userDetail = await userModule.findById({ _id: id });

      const existingIndivUser = await userIndiviuals.findOne({ user_id: id });

      let individualsData = {};
      let message = "";
      if (datas.type == "individuals" && datas.individualStatus == 0) {
        individualsData = {
          ...existingIndivUser?.individuals,
          surname: datas.surname,
          dob: datas.dob,
          citizenship: datas.citizenship,
          actual_address: datas.actual_address,
        }
        message = "Personal information"
      } else if (datas.type == "individuals" && datas.individualStatus == 1) {
        individualsData = {
          ...existingIndivUser?.individuals,
          passport_information: {
            ...existingIndivUser?.individuals?.passport_information,
            number: datas.number,
            expiry_date: datas.expiry_date,
            tax_residency: datas.tax_residency,
            tax_number: datas.tax_number,
            source_wealth: datas.source_wealth,
            other_option: datas.other_option
          }
        }
        message = "ID or Passport information"
      } else if (datas.type == "individuals" && datas.individualStatus == 2) {
        individualsData = {
          ...existingIndivUser?.individuals,
          passport_information: {
            ...existingIndivUser?.individuals?.passport_information,
            public_officials_1: {
              officials_1: datas.officials_1,
              specify_official_1: datas.specify_official_1,
            },
            public_officials_2: {
              officials_2: datas.officials_2,
              specify_official_2: datas.specify_official_2,
              position_held: datas.position_held,
              period: datas.period,
              relationship: datas.relationship,
            },
          },
          occupation_details: {
            occupation: datas.occupation,
            other_option: datas.other_option,
            incomename: datas.incomename,
            incometransaction: datas.incometransaction,
            monthlyincomeamount: datas.monthlyincomeamount,
            outgoingtransaction: datas.outgoingtransaction,
            monthlyoutgoingamount: datas.monthlyoutgoingamount,
            purposeofusingrempic: datas.purposeofusingrempic
          }
        };
        message = "KYC/ Due diligence Form"
      }

      const formData = {
        user_id: id,
        user_email: userDetail.email,
        individualStatus: datas.individualStatus,
        individuals: individualsData
      };

      const updateFormData = {
        individualStatus: datas.individualStatus,
        individuals: individualsData
      };
      if (!existingIndivUser) {
        // Create
        const createFormData = new userIndiviuals(formData);
        const createIndividual = await createFormData.save();
        if (createIndividual) {
          res.send({
            status: true,
            message: `${message} Data Created Successfully`,
          });
        } else {
          res.send({ status: false, message: "User Data Failed to Create..." });
        }
      } else {
        // Update
        const updateIndividual = await userIndiviuals.findOneAndUpdate(
          { user_id: id },
          { $set: updateFormData },
          { new: true }
        );
        if (updateIndividual) {
          res.send({
            status: true,
            message: `${message} Data Updated Successfully`,
            data: updateIndividual.individualStatus,
          });
        } else {
          res.send({ status: false, message: "User Data Failed to Update..." });
        }
      }
    } catch (error) {
      // console.log(error, "error======");

      if (error instanceof multer.MulterError) {
        return res.status(500).json({ error: error.message });
      }
      console.error("Error updating/creating user data:", error);
      res.status(500).send({ status: false, message: "Internal Error..." });
    }
  };

  // user_register_form = async (req, res) => {
  //   const id = res.locals.user_id;
  //   const datas = req.body;
  //   let Images = null;

  //   if (req.files?.stampimage && req.files.stampimage.length > 0) {
  //     Images = req.files.stampimage[0].path;
  //   } else if (req.files?.signature && req.files.signature.length > 0) {
  //     Images = req.files.signature[0].path;
  //   }
  //   // console.log("Images", Images);
  //   // console.log("datas", datas);

  //   try {
  //     const userDetail = await userModule.findById({ _id: id });

  //     const existingIndivUser = await userIndiviuals.findOne({ user_id: id });

  //     const legalEntity = datas.legal_Entity
  //       ? {
  //         ...datas.legal_Entity,
  //         stampimage: Images || null,
  //       }
  //       : null;
  //     // console.log(legalEntity, "legalEntity");

  //     let individualsData = {};
  //     let uboData = {};
  //     if (datas.type == "individuals") {
  //       individualsData = {
  //         surname: datas.surname,
  //         dob: datas.dob,
  //         birth_place: datas.birth_place,
  //         citizenship: datas.citizenship,
  //         actual_address: datas.actual_address,
  //         domicile: datas.domicile,
  //         passport_information: {
  //           document_name: datas.document_name,
  //           number: datas.number,
  //           issuing_body: datas.issuing_body,
  //           expiry_date: datas.expiry_date,
  //           work_place: datas.work_place,
  //           share_capital: datas.share_capital,
  //           tax_residency: datas.tax_residency,
  //           tax_number: datas.tax_number,
  //           source_wealth: datas.source_wealth,
  //           public_officials_1: {
  //             officials_1: datas.officials_1,
  //             specify_official_1: datas.specify_official_1,
  //           },
  //           public_officials_2: {
  //             officials_2: datas.officials_2,
  //             specify_official_2: datas.specify_official_2,
  //             position_held: datas.position_held,
  //             period: datas.period,
  //             relationship: datas.relationship,
  //           },
  //           shareHolder_nominee: datas.shareHolder_nominee,
  //           phone_number: datas.phone_number,
  //           email: datas.email,
  //           date: datas.date,
  //           signature: Images ? Images : datas.signature,
  //         },
  //       };
  //     } else if (datas.type == "ubo") {
  //       uboData = {
  //         first_name: datas.first_name,
  //         last_name: datas.last_name,
  //         patronymic: datas.patronymic,
  //         dob: datas.dob,
  //         birth_place: datas.birth_place,
  //         citizenship: datas.citizenship,
  //         company_shareCapital: datas.company_shareCapital,
  //         domicile: datas.domicile,
  //         actual_address: datas.actual_address,
  //         source_wealth: datas.source_wealth,
  //         tax_residency: datas.tax_residency,
  //         tax_number: datas.tax_number,
  //         public_officials_1: {
  //           officials_1: datas.officials_1,
  //           specify_official_1: datas.specify_official_1,
  //         },
  //         public_officials_2: {
  //           officials_2: datas.officials_2,
  //           specify_official_2: datas.specify_official_2,
  //           position_held: datas.position_held,
  //           period: datas.period,
  //           relationship: datas.relationship,
  //         },
  //         phone_number: datas.phone_number,
  //         passport_information: {
  //           document_name: datas.document_name,
  //           number: datas.number,
  //           issuing_body: datas.issuing_body,
  //           expiry_date: datas.expiry_date,
  //           business_activity: datas.business_activity,
  //           signature: Images ? Images : datas.signature,
  //         },
  //       };
  //     }

  //     const formData = {
  //       user_id: id,
  //       user_email: userDetail.email,
  //       individualStatus: datas.legal_Entity
  //         ? 1
  //         : datas.type === "individuals"
  //           ? 0
  //           : datas.type === "ubo"
  //             ? 2
  //             : 0,
  //       ...(datas.type === undefined &&
  //         legalEntity && { legal_Entity: legalEntity }),
  //       ...(datas.type === "individuals" &&
  //         individualsData && { individuals: individualsData }),
  //       ...(datas.type === "ubo" && uboData && { ubo: uboData }),
  //     };

  //     const updateFormData = {
  //       individualStatus: datas.legal_Entity
  //         ? 1
  //         : datas.type === "individuals"
  //           ? 0
  //           : datas.type === "ubo"
  //             ? 2
  //             : 0,
  //       ...(datas.type === undefined &&
  //         legalEntity && { legal_Entity: legalEntity }),
  //       ...(datas.type === "individuals" &&
  //         individualsData && { individuals: individualsData }),
  //       ...(datas.type === "ubo" && uboData && { ubo: uboData }),
  //     };

  //     if (!existingIndivUser) {
  //       // Create
  //       const createFormData = new userIndiviuals(formData);
  //       const createIndividual = await createFormData.save();
  //       if (createIndividual) {
  //         res.send({
  //           status: true,
  //           message: "User Data Created Successfully...",
  //         });
  //       } else {
  //         res.send({ status: false, message: "User Data Failed to Create..." });
  //       }
  //     } else {
  //       // Update
  //       const updateIndividual = await userIndiviuals.findOneAndUpdate(
  //         { user_id: id },
  //         { $set: updateFormData },
  //         { new: true }
  //       );
  //       if (updateIndividual) {
  //         res.send({
  //           status: true,
  //           message: "User Data Updated Successfully...",
  //           data: updateIndividual.individualStatus,
  //         });
  //       } else {
  //         res.send({ status: false, message: "User Data Failed to Update..." });
  //       }
  //     }
  //   } catch (error) {
  //     // console.log(error, "error======");

  //     if (error instanceof multer.MulterError) {
  //       return res.status(500).json({ error: error.message });
  //     }
  //     console.error("Error updating/creating user data:", error);
  //     res.status(500).send({ status: false, message: "Internal Error..." });
  //   }
  // };

  UserDeactive = async (req, res) => {
    const id = res.locals.user_id;
    const password = req.body.password;
    const type = req.body.type;
    const deleteBy = req.body.deleteBy;
    try {
      const userData = await userModule.findById(id);

      if (!userData) {
        return res
          .status(404)
          .send({ status: false, message: "User not found." });
      }

      const decryptedPassword = CryptoJS.AES.decrypt(
        userData.password,
        Config.userEncrypt
      );
      const orginaText = decryptedPassword.toString(CryptoJS.enc.Utf8);

      if (password != orginaText) {
        return res.send({ status: false, message: "Incorrect password." });
      }
      const userAcc = await userModule.findByIdAndUpdate(
        { _id: id },
        {
          $set: {
            account_status: "Deleted",
            deletedDate: Date.now(),
            deletedBy: deleteBy,
          },
        },
        { new: true }
      );
      if (userAcc) {
        res.send({
          status: true,
          message: "User Data has been Deactivated",
          user: userAcc,
        });
      } else {
        return res.send({
          status: false,
          message: "Failed to deactivate the user account.",
        });
      }
    } catch (error) {
      res.status(500).json({ status: false, message: "something went wrong" });
    }
  };

  userLogout = async (req, res) => {
    const id = res.locals.user_id;
    try {
      await userModule
        .findByIdAndUpdate(
          { _id: id },
          {
            $set: {
              user_auth: "",
            },
          }
        )
        .then((val) => {
          const existingSession = activeSession.get(val.email);
          if (existingSession && existingSession.email === val.email) {
            activeSession.delete(val.email);
            userSocketMap.delete(val.email);
          }
          res.send({ status: true });
        })
        .catch(() => {
          res.send({ status: false });
        });
    } catch (error) {
      res.status(500).json({ status: false, message: "something went wrong" });
    }
  };

  changepassword = async (req, res) => {
    const id = res.locals.user_id;
    const { oldpassword, newPassWord, confirmPassWord } = req.body;
    try { 
      const users = await userModule.findOne({ _id: id });
      const userPass = users.password;
      const bytes = CryptoJS.AES.decrypt(userPass, Config.userEncrypt);
      const originalText = bytes.toString(CryptoJS.enc.Utf8);

      if (newPassWord !== "" && confirmPassWord !== "" && oldpassword !== "") {
        if (originalText == oldpassword) {
          if (confirmPassWord == newPassWord) {
            const newEncryptedPassword = CryptoJS.AES.encrypt(
              newPassWord,
              Config.userEncrypt
            ).toString();
            const updatedUser = await userModule.findByIdAndUpdate(users._id, {
              $set: { password: newEncryptedPassword },
            });

            if (!updatedUser) {
              res
                .status(200)
                .send({ status: false, message: "Unable to Change Password" });
            } else if (oldpassword == newPassWord) {
              res.status(200).send({
                status: false,
                message: "Old Password and New Password Should not be same",
              });
            } else {
              res.status(200).send({
                status: true,
                message: "Password Changed Successfully",
              });
            }
          } else {
            res.status(200).send({
              status: false,
              message: "New Password and Confirm Password doesn't Match",
            });
          }
        } else {
          res
            .status(200)
            .send({ status: false, message: "Old Password Doesn't Match" });
          return;
        }
      } else {
        res.status(200).send({
          status: false,
          message:
            "Password cannot be empty Please fill the Password details..!",
        });
        return;
      }
    } catch (error) {
      console.error(error);
      res.status(500).send({ status: false, message: "Internal Server Error" });
    }
  };

  // profile Update

  updateProfile = async (req, res) => {
    const id = res.locals.user_id;
    const {
      first_name,
      last_name,
      country,
      phone,
      country_Code,
      Images,
      address_1,
      address_2,
      resident_country,
      state,
      city,
      zip_code
    } = req.body;
    const image = req.file ? req.file.path : null;
    // console.log(image, "image");

    if (phone) {
      function stripCountryCode(phone, country_Code) {
        const code = country_Code.replace("+", "");

        if (phone.startsWith(code)) {
          return phone.slice(code.length);
        }

        return phone;
      }

      let strippedPhone = stripCountryCode(phone, country_Code);

      const kycuser = await kycUserData.findOne({
        user_id: id,
      });
      if (!kycuser) {
        return res
          .status(404)
          .json({ status: false, message: "User Not Apply KYC" });
      }
      await kycUserData.updateOne(
        { user_id: id },
        {
          $set: {
            "phone_number.0.country": country,
            "phone_number.0.country_code": country_Code,
            "phone_number.0.number": strippedPhone,
            "phone_number.0.phoneNo_verify": true, // or true, based on your logic
          },
        }
      );
    }
    try {
      const user = await userModule.findById(id);
      if (!user) {
        return res
          .status(404)
          .json({ status: false, message: "User not found" });
      }

      if (address_1 || address_2 || resident_country || state || city || zip_code) {
        await kycUserData.updateOne(
          { user_id: id },
          {
            $set: {
              "current_Address.0.address_1": address_1,
              "current_Address.0.address_2": address_2,
              "current_Address.0.resident_country": resident_country,
              "current_Address.0.state": state,
              "current_Address.0.city": city,
              "current_Address.0.zip_code": zip_code,
            },
          }
        );
      }

      await userModule.updateOne(
        { _id: id },
        {
          $set: {
            first_name,
            last_name,
            profile: Images || image,
          },
        }
      );

      // await kycUserData.updateOne(
      //     { user_id: id },
      //     {
      //         $set: { "phone_number.number": phone_number }
      //     }
      // );

      return res
        .status(200)
        .json({ status: true, message: "Profile updated successfully" });
    } catch (error) {
      console.error("Error updating profile:", error);
      return res
        .status(500)
        .json({ status: false, message: "Internal server error" });
    }
  };
  getUserCopyRightsData = async (req, res) => {
    try {
      const UserCopyRightsData = await SiteSetting.find({});
      //   console.log("CopyRightsData", UserCopyRightsData);
      if (UserCopyRightsData) {
        return res.send({
          status: true,
          data: UserCopyRightsData,
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
}

module.exports = new login_register();
