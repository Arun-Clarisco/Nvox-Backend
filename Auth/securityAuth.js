const {decryptData} = require("../Config/Security")

exports.encMiddleWare = async (req, res, next) => {
    try {
      if (Object.keys(req.body).length === 0) {
        return next();
      };
      if (req.body && Object.keys(req.body).length === 1) {
        const payload = await decryptData(req.body.encryptedData);
        if (payload) {
          req.body = payload;
          return next();
        } else {
          return res.status(403).json({ status: false, message: "Decryption Failed" });
        };
      }else{
        return res.status(403).json({ status: false, message: "Decryption Failed!!" });
      };
    } catch (error) {
      return res.status(403).json({ status: false, message: "Decryption Failed!!!!!" });
    };
  };