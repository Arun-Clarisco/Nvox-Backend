require('dotenv').config();

const config = {
    TransakAPI:process.env.TRANSAK_API,
    TransakSecret:process.env.TRANSAK_API_SECRET,
    TransakAPIURL:process.env.TRANSAK_API_URL,

    PORT: process.env.PORT,
    serverType: process.env.SERVER_TYPE,
    MongoCluster: process.env.MONGO_DB,
    Frontend_URL: process.env.FRONTEND_URL,
    AdminPanel_URl: process.env.ADMIN_URL,
    userEncrypt: process.env.USER_ENCRYPT,
    AdminencdcrKey: process.env.ADMIN_ENCRYPT,
    JWT_ADMIN_SECRET: process.env.JWT_ADMIN_SECRET,
    JWT_USER_SECRET: process.env.JWT_USER_SECRET,
    SECURITY_KEY :process.env.SECURITY_KEY,
    // SMTP Mail
    SMTP_Host: process.env.SMTP_Host_Url,
    mailCredUserName: process.env.MAIL_USER,
    // Mail
    mailFromAddress: process.env.MAIL_ADDRESS,
    mailCredPassword: process.env.MAIL_PASS,
    // Common mail
    mailFromAddress1: process.env.MAIL_ADDRESS1,
    // Support mail
    mailFromAddress2: process.env.MAIL_ADDRESS2,
    // KYC mail
    mailFromAddress3: process.env.MAIL_ADDRESS3,

    MAIL_CONFIRM_SECRET: process.env.MAIL_SECRET,
    // Cloudinary
    CLOUD_NAME: process.env.CLOUD_NAME,
    CLOUDINARY_APIKEY: process.env.CLOUDINARY_APIKEY,
    CLOUDINARY_SECRET: process.env.CLOUDINARY_SECRET,
    Cloudinary_logo: process.env.CLOUDINARY_LOGO,
    // Twilio
    Account_SID: process.env.ACCOUNT_SID,
    Auth_Token: process.env.AUTH_TOKEN,
    Admin_NUMB: process.env.ADMIN_NUMB,
    // KYC API
    Level_Name: process.env.LEVEL_NAME,
    APP_Token: process.env.APP_TOKEN,
    Secret_Key: process.env.APP_KEY,
    // Coin-Market-Cap
    CMC_Api: process.env.API_KEY,

    BTCURL : process.env.BTC_URL, 
    BTC_TokenAPI : process.env.BTC_TokenAPI,
}
// 0x59acad33c2f1d0193d5a3538192c23f1d9d2de18
module.exports = config



