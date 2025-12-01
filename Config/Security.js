const CryptoJS = require("crypto-js");
const Config = require('../Config/config')

// Encrypt function
exports.encryptData = (data) => {
    try {
        return CryptoJS.AES.encrypt(JSON.stringify(data), Config.SECURITY_KEY).toString();
    } catch (error) {
        console.error("Encryption error:", error);
        return null;
    }
};

// Decrypt function
exports.decryptData = (ciphertext) => {
    try {
        const bytes = CryptoJS.AES.decrypt(ciphertext, Config.SECURITY_KEY);
        return JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
    } catch (error) {
        console.error("Decryption error:", error);
        return null;
    }
};