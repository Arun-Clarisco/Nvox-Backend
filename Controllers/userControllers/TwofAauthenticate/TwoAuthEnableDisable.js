const UserDb = require("../../../Modules/userModule/userModule");
const speakeasy = require("speakeasy");
const { encryptData } = require("../../../Config/Security");
const QRCode = require("qrcode");
const Config = require("../../../Config/config");
const jwt = require("jsonwebtoken");
const { activeSession, pendingSession, userSocketMap } = require("../../../Auth/userAuth");
const socketHelper = require("../../socket/socketCommon");

//.................. .................generate secret....................
const generateSecret = async (req, res) => {
  try {
    const userId = res.locals.user_id;
    const { action } = req.body;
    let encryptedData;

    // console.log("User ID:", userId);
    // console.log("Action:", action);

    const getUser = await UserDb.findById(userId);

    if (!getUser) {
      return res.json({ status: false, message: "User not found" });
    }

    // .......................generate new secret & QR...................

    if (action == "generate") {
      const secretToken = speakeasy.generateSecret({ length: 15 });
      const issuer = "Rempic";
      const label = getUser.email;
      const otpauthUrl = `otpauth://totp/${encodeURIComponent(
        issuer
      )}:${encodeURIComponent(label)}?secret=${secretToken.base32
        }&issuer=${encodeURIComponent(issuer)}`;

      QRCode.toDataURL(otpauthUrl, async (err, image_data) => {
        if (err) {
          return res.json({ status: false, message: "QR generation failed" });
        }
        // let encryptedData;
        // console.log("secret", secretToken);

        const secretKeyUpdate = await UserDb.findByIdAndUpdate(
          { _id: userId },
          { TFASecretKey: secretToken.base32 }
        );
        // console.log("secretKeyUpdate", secretKeyUpdate);

        const secretKeyData = await UserDb.findById({ _id: userId }).exec();
        // console.log("secretKeyData", secretKeyData);

        if (secretToken.base32) {
          encryptedData = encryptData({
            status: true,
            // secretToken: secretToken.base32,
            qrImage: image_data,
            TfaStatus: getUser.TFAStatus,
            secretKeyData,
          });
        } else {
          encryptedData = encryptData({
            status: false,
            message: "Failed to generate 2FA secret key",
          });
        }

        return res.json({ data: encryptedData });
      });
    }

    // 2️⃣ ...............................Enable 2FA..................................
    else if (
      action == "Enable" &&
      getUser.TFASecretKey &&
      getUser.TFAStatus == true
    ) {
      // console.log("work");

      const { secret, otp } = req.body;
      // console.log("work");

      // console.log("req.body", req.body);
      if (!otp) {
        encryptedData = encryptData({
          status: false,
          message: "Please Enter code to Verify 2FA",
        });
        // console.log("encryptedData>>>>>>", encryptedData);
        return res.json({ data: encryptedData });
      }

      const verified = speakeasy.totp.verify({
        secret: secret,
        encoding: "base32",
        token: otp,
        window: 0,
      });
      console.log("verified", verified);

      if (!verified) {
        encryptedData = encryptData({
          status: false,
          message: "Invalid 2FA code.",
        });
        // console.log("encryptedData>>>>>>", encryptedData);
        return res.json({ data: encryptedData });
      }

      const secretToken = secret;

      // console.log("secretToken", secretToken);

      let EnableUpdateData;
      if (secretToken) {
        // console.log("secretToken inside if", secretToken);
        EnableUpdateData = await UserDb.findByIdAndUpdate(
          { _id: userId },
          { TFAStatus: false, TFASecretKey: "", TFAEnableKey: secretToken, adminDisableStatus: 1 }
        );
      } else {
        EnableUpdateData = await UserDb.findByIdAndUpdate(
          { _id: userId },
          { TFAStatus: true }
        );
      }

      // console.log("EnableUpdateData", EnableUpdateData);
      const findEnableUpdateData = await UserDb.findById({
        _id: userId,
      }).exec();
      // console.log("findEnableUpdateData", findEnableUpdateData);

      // const encryptedData = encryptData({
      // status: true,
      // message: "2FA Enabled Successfully",
      // });
      if (secretToken) {
        encryptedData = encryptData({
          status: true,
          message: "2FA Enabled Successfully",
          findEnableUpdateData,
        });
      } else {
        encryptedData = encryptData({
          status: false,
          message: "Failed to Enable 2FA",
        });
      }

      return res.json({ data: encryptedData });

      // return res.json({ data: encryptedData }  );
    }

    // 3️⃣ .......................................Disable 2FA.....................
    else if (
      action == "Disable" &&
      getUser.TFAEnableKey &&
      getUser.TFAStatus == false
    ) {
      // console.log("work2--");
      const getSecretKey = await UserDb.findById({ _id: userId }).exec();

      // console.log("getSecretKey", getSecretKey);
      const { otp } = req.body;
      // console.log("req.body", req.body);
      if (otp == "") {
        encryptedData = encryptData({
          status: false,
          message: "Please Enter code to Verify 2FA",
        });
        // console.log("encryptedData>>>>>>", encryptedData);
        return res.json({ data: encryptedData });
      }

      const verified = speakeasy.totp.verify({
        secret: getSecretKey.TFAEnableKey,
        encoding: "base32",
        token: otp,
        window: 0,
      });
      // console.log("verified", verified);

      if (!verified) {
        encryptedData = encryptData({
          status: false,
          message: "Invalid 2FA code.",
        });
        // console.log("encryptedData>>>>>>", encryptedData);
        return res.json({ data: encryptedData });
      }

      let DisableUpdateData;

      if (getSecretKey.TFAEnableKey) {
        // console.log("secretToken inside if", getSecretKey.TFASecretKey);
        DisableUpdateData = await UserDb.findByIdAndUpdate(
          { _id: userId },
          { TFAStatus: true, TFAEnableKey: "", adminDisableStatus: 0 }
        );
      }

      // console.log("DisableUpdateData", DisableUpdateData);
      const findDisableUpdateData = await UserDb.findById({
        _id: userId,
      }).exec();
      // console.log("findDisableUpdateData", findDisableUpdateData);

      if (findDisableUpdateData) {
        encryptedData = encryptData({
          status: true,
          message: "2FA Disable Successfully",
          findDisableUpdateData,
        });
      } else {
        encryptedData = encryptData({
          status: false,
          message: "Failed to disable 2FA",
        });
      }
      // const encryptedData = encryptData({
      //   status: true,
      //   message: "2FA Disable Successfully",
      //   findDisableUpdateData
      // });

      return res.json({ data: encryptedData });
    }
    // .....................Invalid Action....................
    else {
      encryptedData = encryptData({
        status: true,
        message: "Invalid Action Type",
      });
      return res.json({ data: encryptedData });
    }
  } catch (err) {
    console.error("2FA Error:", err);
    encryptedData = encryptData({
      status: false,
      message: "Something Went Wrong! please Try again Later",
    });
    return res.json({ data: encryptedData });
  }
};

const get2faStatus = async (req, res) => {
  try {
    const getuserId = res.locals.user_id;
    const getUserData = await UserDb.findOne({ _id: getuserId });
    // console.log("getUserData", getUserData);
    let get2fstatusEncrypt;
    if (getUserData) {
      get2fstatusEncrypt = encryptData({
        status: true,
        getUserData,
      });
    } else {
      get2fstatusEncrypt = encryptData({
        status: false,
        message: "Something Went Wrong! please Try again Later",
      });
    }

    return res.json({ data: get2fstatusEncrypt });
  } catch (err) {
    console.error("get 2FA Error:", err);
    return res.status(400).json({
      status: false,
      message: err.message,
    });
  }
};

// const TfaCodeLoginVerify = async (req, res) => {
//   try {
//     const { email, otp } = req.body;
//     console.log("req", req.body);
//     let TfaLoginEncryptData;
//     const userData = await UserDb.findOne({ email: email });
//     console.log("userData", userData);

//     if (otp == "") {
//       TfaLoginEncryptData = encryptData({
//         status: false,
//         message: "Please Enter code to Verify 2FA",
//       });
//       console.log("encryptedData>>>>>>", TfaLoginEncryptData);
//       return res.json({ data: TfaLoginEncryptData });
//     }

//     const verified = speakeasy.totp.verify({
//       secret: userData.TFAEnableKey,
//       encoding: "base32",
//       token: otp,
//       window: 1,
//     });
//     console.log("verified", verified);

//    const token = jwt.sign({ id: userData._id }, Config.JWT_USER_SECRET, {
//       expiresIn: "12h",
//     });

//     await UserDb.findOneAndUpdate(
//       { email },
//       { $set: { user_auth: token } }
//     );

//     activeSession.set(email, { email, token });


//     if (!verified) {
//       TfaLoginEncryptData = encryptData({
//         status: false,
//         message: "Invalid 2FA code.",
//       }); 
//     } else if (verified == true || verified) {
//       TfaLoginEncryptData = encryptData({
//         status: true,
//         message: "2FA verification completed. You are logged in.",
//         verified, 
//         DisableUpdateData
//         // token: token,
//       });
//     }


//     const encryptedResponse = encryptData({
//       status: true,
//       verified: true,
//       message: "2FA verification completed. You are logged in.",
//       token,
//       userData,
//     });

//       return res.send({ data: encryptedResponse });

//     } 

//    catch (err) {
//     console.error("2FA Error:", err);
//     TfaLoginEncryptData = encryptData({
//       status: false,
//       message: "Something Went Wrong! please Try again Later",
//     });
//     return res.json({ data: TfaLoginEncryptData });
//   }
// };  

// ....................2fa  login verify......................

// const TfaCodeLoginVerify = async (req, res) => {
//   try {
//     const { email, otp } = req.body;
//     const userData = await UserDb.findOne({ email: email });

//     if (!otp) {
//       const encrypted = encryptData({
//         status: false,
//         message: "Please Enter code to Verify 2FA",
//       });
//       return res.json({ data: encrypted });
//     }

//     const verified = speakeasy.totp.verify({
//       secret: userData.TFAEnableKey,
//       encoding: "base32",
//       token: otp,
//       window: 0,
//     });

//     if (!verified) {
//       const encrypted = encryptData({
//         status: false,
//         message: "Invalid 2FA code.",
//       });
//       return res.json({ data: encrypted });
//     }

//     // ✅ verified success - generate token
//     const token = jwt.sign({ id: userData._id }, Config.JWT_USER_SECRET, {
//       expiresIn: "12h",
//     });

//     await UserDb.findOneAndUpdate(
//       { email },
//       { $set: { user_auth: token } }
//     );

//     activeSession.set(email, { email, token }); 
//     let DisableUpdateData;

//     if (userData.TFAEnableKey) {
//       DisableUpdateData = await UserDb.findByIdAndUpdate(
//         { _id: userData.id },
//         { TFAStatus: false, TFASecretKey: "" }
//       );
//     } else {
//       DisableUpdateData = await UserDb.findByIdAndUpdate(
//         { _id: userData.id },
//         { TFASecretKey: "" }
//       );
//     } 

//     // console.log("DisableUpdateData", DisableUpdateData); 

//     const encryptedResponse = encryptData({
//       status: true,
//       verified: true,
//       message: "2FA verification completed. You are logged in.",
//       token,
//       userData, 
//       DisableUpdateData
//     });

//     return res.json({ data: encryptedResponse });

//   } catch (err) {
//     console.error("2FA Error:", err);
//     const encrypted = encryptData({
//       status: false,
//       message: "Something Went Wrong! please Try again Later",
//     });
//     return res.json({ data: encrypted });
//   }
// };

const TfaCodeLoginVerify = async (req, res) => {
  try {
    const { email, otp } = req.body;
    const userData = await UserDb.findOne({ email });

    if (!otp) {
      const encrypted = encryptData({
        status: false,
        message: "Please enter OTP to verify",
      });
      return res.json({ data: encrypted });
    }

    // Check if trying OTP without login stage
    const pending = pendingSession.get(email);
    if (!pending) {
      const encrypted = encryptData({
        status: false,
        message: "Session expired. Please login again.",
      });
      return res.json({ data: encrypted });
    }

    // Verify OTP
    const verified = speakeasy.totp.verify({
      secret: userData.TFAEnableKey,
      encoding: "base32",
      token: otp,
      window: 0,
    });

    if (!verified) {
      const encrypted = encryptData({
        status: false,
        message: "Invalid OTP",
      });
      return res.json({ data: encrypted });
    }

    // =========================================================
    // OTP CORRECT → FORCE LOGOUT OLD SESSION NOW
    // =========================================================
    const existingSession = activeSession.get(email);

    if (existingSession) {
      await UserDb.findOneAndUpdate(
        { email },
        { $set: { user_auth: "" } }
      );

      const socket = socketHelper.GetSocket();
      const socketId = userSocketMap.get(email);

      if (socketId) {
        socket.to(socketId).emit("forceLogout", {
          reason: "Logged out due to new login",
        });
      }

      activeSession.delete(email);
    }

    // Create new token
    const token = jwt.sign(
      { id: userData._id },
      Config.JWT_USER_SECRET,
      { expiresIn: "12h" }
    );

    await UserDb.findOneAndUpdate(
      { email },
      { $set: { user_auth: token } }
    );

    activeSession.set(email, { email, token });

    // Remove from pending queue
    pendingSession.delete(email);

    const encryptedResponse = encryptData({
      status: true,
      verified: true,
      message: "2FA verification completed.",
      token,
      userData
    });

    return res.json({ data: encryptedResponse });

  } catch (error) {
    console.error("2FA Error:", error);
    const encrypted = encryptData({
      status: false,
      message: "Something went wrong! Please try again later",
    });
    return res.json({ data: encrypted });
  }
};


module.exports = { generateSecret, get2faStatus, TfaCodeLoginVerify };
