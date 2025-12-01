const express = require('express');
const router = express.Router();
const { uploads } = require("../Clodinary/storage")
const usersData = require("../Controllers/userControllers/login&register");
const userGetData = require("../Controllers/userControllers/user_getMethods")
const kycVerify = require("../Controllers/userControllers/SDK")
const userAuth = require("../Auth/userAuth");
const mobileAppRoute = require('../Controllers/userControllers/mobileAppRoute');
const SocketData = require("../Controllers/userControllers/trade")
const ltcAddrress = require('../CoinTransaction/LTC');
const WalletController = require("../Controllers/userControllers/WalletController");
const Transak = require("../Controllers/userControllers/buy&sell");
const securityAuth = require('../Auth/securityAuth')
const notificationController = require('../Controllers/userControllers/notificationController')
const EthAddressCreate = require("../CoinTransaction/ETH");
const AdaCreateAddress = require('../CoinTransaction/ADA');
const SupportTicketController = require('../Controllers/userControllers/SupportTicketController')
const userControl = require('../Controllers/userControllers/userController'); 
const TwoAuthController = require("../Controllers/userControllers/TwofAauthenticate/TwoAuthEnableDisable");   


router.post("/user-auth", userAuth.verifyToken, (req, res) => {
    try {
        res.send({ status: true, message: "User verified" });
    } catch (error) {
        res.send({ status: false, message: "Something went wrong..!" });
    }
});

router.post("/user-signup", securityAuth.encMiddleWare, usersData.user_Register);
router.post("/user-registerOTP", usersData.verifyRegisterOTP)
router.post("/user-resendOTP", usersData.resendMailOTP)
router.post('/user-signin', securityAuth.encMiddleWare, usersData.user_Login);
router.post("/user-registerForm", uploads.fields([
    { name: 'signature' },
    { name: 'stampimage' }   
]), userAuth.verifyToken, usersData.user_register_form)
router.post("/user-businessrForm", uploads.fields([
    { name: 'Memorandum_document' },
    { name: 'Incorporation_document' },
    { name: 'Directors_document' },
    { name: 'goodstanding_document' },
    { name: 'Incumbency_document' },
    { name: 'Shareholders_document' },
    { name: 'Legalownership_document' },
    { name: 'Operatinglicense_document' },
    { name: 'DeclarationofTrust_document' },
    { name: 'TrustSettlement_document' },
    { name: 'OnboardingForm_document' },
    { name: 'Annualfinancial_document' },
    { name: 'Auditedfinancial_document' },
    { name: 'absenceof_document' },
    { name: 'IdentityCardorPassport_document' },
    { name: 'permanentaddress_document' },
    { name: 'Accountopening_document' },
    { name: 'AML_CTF_document' },
    { name: 'signature' },
    { name: "stampimage" }
]), userAuth.verifyToken, usersData.bussiness_form);
router.post("/user-forget-password", usersData.forgetpass);
router.post("/user-reset-password", usersData.resetpass);
router.post("/user-kyc-verification", userAuth.verifyToken, usersData.kyc_form);
router.post("/user-kyc-sec-verification", userAuth.verifyToken, usersData.kyc_form_sec);
router.post("/user-mobile-otp", userAuth.verifyToken, usersData.phone_otp);
router.post("/user-verifyPhone-otp", userAuth.verifyToken, usersData.verifyPhone_otp);
router.post("/user-Deactive", userAuth.verifyToken, usersData.UserDeactive);
router.post("/user-logout", userAuth.verifyToken, usersData.userLogout);
router.post("/changePassword", userAuth.verifyToken, usersData.changepassword);
router.post("/profileUpdate", uploads.single('Images'), userAuth.verifyToken, usersData.updateProfile)
router.post("/user-register-verifyPhone-otp", usersData.verifySignUp_Phone_otp);
router.post("/user-register-mobile-otp", usersData.register_Phone_otp);



// KYC Verification 
router.post("/user-generateSDK", userAuth.verifyToken, kycVerify.verifyKyc);
router.post("/user-verifyStatus", userAuth.verifyToken, kycVerify.statusCheck);


// Get Methods
router.get("/user-userData", userAuth.verifyToken, userGetData.userGetData);
router.get("/user-getProfile", userAuth.verifyToken, userGetData.getUserProfile);
router.get("/user-kycData", userAuth.verifyToken, userGetData.kycGetData);
router.get("/user-PhoneData", userGetData.getPhoneData);
router.get("/user-individual-data", userAuth.verifyToken, userGetData.IndivGetData);
router.post("/user-formStatusData", userAuth.verifyToken, userGetData.userOnboarding);
router.get("/user-formStatusData", userAuth.verifyToken, userGetData.userOnboarding);
// router.post("/user-formStatusData", userAuth.verifyToken, userGetData.userOnboarding);

router.post("/get-depositHistory", userAuth.verifyToken, userGetData.userDepositHistory);
router.post("/get-withdrawHistory", userAuth.verifyToken, userGetData.userWithdrawHistory);
router.get("/get-UserProfile-datas", userAuth.verifyToken, userGetData.userDetail);
router.get("/get-TradeOder-History", userAuth.verifyToken, userGetData.TradeOrderHistory);
router.get("/get-Transaction-list", userAuth.verifyToken, userGetData.getUserTransactionData);
router.get("/get-DepositChart-History", userAuth.verifyToken, userGetData.depositChartHistory);
router.get("/get-TotalChart-Amount", userAuth.verifyToken, userGetData.TotalamountChart);
router.post("/get-individualTradeOder-History", userAuth.verifyToken, userGetData.individualTradeOderHistory);
router.get("/check-account-status", userAuth.verifyToken, userGetData.getAccountStatus);


// Mobile Forgot and Reset Password
router.post("/mobile-forgot-password", mobileAppRoute.forgotPassword);
router.post("/mobile-verify-otp", mobileAppRoute.verifyForgotOTP);
router.post("/mobile-reset-password", mobileAppRoute.resetPassword);
router.post("/mobile-resend-otp", mobileAppRoute.resendMobileOTP);
router.post("/get-access",securityAuth.encMiddleWare, mobileAppRoute.MobileLogOut)

//socket
router.post("/cryptoLivePrice", userAuth.verifyToken, SocketData.Coincreate);
// router.post("/total-AssetValue", userAuth.verifyToken,userControl.livePriceData);
// router.post("/createOrder", SocketData.createOrder );
// router.post("/cancel_order", SocketData.cancelOrder);

// deposit
// coinTransaction
router.post("/createAddress", userAuth.verifyToken, WalletController.createAddress);
router.post("/coinDeposit", userAuth.verifyToken, WalletController.handleDeposit);

// Withdraw
router.post("/create-user-withdraw-request", userAuth.verifyToken, WalletController.userWithdrawRequest);
// router.get("/user-getBalance", userAuth.verifyToken, WalletController.userGetBalance);

//buy & sell Crypto Fiat
router.get("/fiat-currencies", userAuth.verifyToken, Transak.fiatcurrencies);
router.get("/crypto-currencies", userAuth.verifyToken, Transak.cryptocurrencies);
router.get("/order", userAuth.verifyToken, Transak.getOrder);
router.get("/get-fiatorder", userAuth.verifyToken, userGetData.userFiatOrderHistoty);
router.get("/updateUserFiatOrder", userAuth.verifyToken, userGetData.UpdateUserFiatOrderHistoty);
router.post("/transak-orderId-Data", userAuth.verifyToken, Transak.orderIdHistory)

//swap
router.post("/user-crypto-swap", userAuth.verifyToken, WalletController.userCryptoSwap);
// router.get("/get-user-swaphistory", userAuth.verifyToken,userGetData.userswaphistory);

router.get("/get-swapHistory", userAuth.verifyToken, userGetData.userSwapHistory);

//Notification
router.post('/clearAllNotification', notificationController.clearAllNotification);
router.post('/getAllNotification', notificationController.getAllNotification);
router.post('/readMessage', notificationController.readMessage);
router.post('/get-History',  userAuth.verifyToken, userGetData.usertransactionHistory);
// get the copyrights data  ......... 
router.get("/get-UserCopyRightsData", usersData.getUserCopyRightsData);

//trade

router.post("/cancel_order",userAuth.verifyToken,SocketData.cancelOrder1); 
// getmobilewebkycdata  

router.get("/get-MobileAndWebkycdocData", userGetData.getMobileAndWebkycdocData);
// two authentication
router.post("/2fa-generateSecret", userAuth.verifyToken, TwoAuthController.generateSecret);  
router.get("/get-2faStatus", userAuth.verifyToken, TwoAuthController.get2faStatus);
router.post("/2fa-LoginVerify", TwoAuthController.TfaCodeLoginVerify);  


// Support Ticket
router.get('/issue-list', userAuth.verifyToken, SupportTicketController.issueList);
router.post('/fileUpload', uploads.array("images[]"), SupportTicketController.updateImages);
router.post("/createticket",userAuth.verifyToken,securityAuth.encMiddleWare, SupportTicketController.createTicket);
router.get("/viewticket/:id",userAuth.verifyToken, SupportTicketController.userViewTickets);
router.post('/chat-ticket', userAuth.verifyToken,securityAuth.encMiddleWare, SupportTicketController.replayTicket);
router.post('/mark-as-read', userAuth.verifyToken,securityAuth.encMiddleWare, SupportTicketController.markUserMessagesRead);


module.exports = router;
