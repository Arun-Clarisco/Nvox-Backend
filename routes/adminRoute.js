const express = require('express');
const router = express.Router();
const adminAuth = require("../Auth/adminAuth")
const adminController = require("../Controllers/adminControllers/adminController")
const adminGetmethods =require('../Controllers/adminControllers/admin_getMethod')
const walletController = require("../Controllers/userControllers/WalletController");
const securityAuth = require('../Auth/securityAuth');
const Transak = require("../Controllers/userControllers/buy&sell");
const { uploads } = require("../Clodinary/storage")
const SubAdminController = require('../Controllers/adminControllers/SubAdminController');
const SupportTicketAdminController = require('../Controllers/adminControllers/SupportTicketAdminController');


router.post("/admin-auth", adminAuth.verifyToken, (req, res) => {
    try {    
        res.send({ status: true, message: "Admin verified" });
    } catch (error) {
        res.send({ status: false, message: "Something went wrong..!" });
    }
});
// ..............admin routes...................
router.post('/admin-create', adminController.create);
router.post('/admin-login',securityAuth.encMiddleWare, adminController.login);
router.post("/admin-change-password", adminAuth.verifyToken, adminController.changePassword)
router.post("/admin-forget-password", adminController.forgetpass)
router.post("/admin-reset-password", adminController.adminResetpassword)
router.post("/get_KYC_Form", adminAuth.verifyToken,adminController.get_kycForm)
router.post("/get_IndividualForm", adminAuth.verifyToken,adminController.get_Individualform)
router.post("/get_BusinessForm", adminAuth.verifyToken,adminController.get_Businessform)
router.post("/UserListAction", adminAuth.verifyToken,adminController.UserListAction)
router.post("/formsDelete", adminAuth.verifyToken,adminController.FormsDelete)
router.post("/getFormDetails",adminAuth.verifyToken,adminController.GetFormsDetails)
router.post("/admin-Settings", adminAuth.verifyToken, adminController.adminAddress)
router.post("/admin-withdrawalProcess", adminAuth.verifyToken, walletController.adminWithdrawProcess)
router.post("/admin_move", adminAuth.verifyToken, walletController.adminMove)
router.post("/coinfeesetting", adminAuth.verifyToken, adminController.coinfeesetting) 
router.post("/create-termsPage", adminAuth.verifyToken, adminController.CreateTermsPage)
// edit terms page 
router.put("/edit-termsPage/:_id", adminAuth.verifyToken, adminController.editTermspageData);


// ..............user routes...................
router.get("/userDetails", adminAuth.verifyToken,adminGetmethods.getuserdetails);
router.get("/user-withdrawRequest", adminAuth.verifyToken, adminGetmethods.adminWithdraw);
router.get("/user-Transactionlist", adminAuth.verifyToken, adminGetmethods.getTransactionHistory);
router.get("/user-OrderHistory", adminAuth.verifyToken, adminGetmethods.getOrderHistory);
router.get("/user-TradeHistory", adminAuth.verifyToken, adminGetmethods.getTradeHistory);
router.get("/user-swapHistory", adminAuth.verifyToken, adminGetmethods.getSwapHistory);
router.get("/spotpair", adminAuth.verifyToken, adminGetmethods.adminspotpair);
router.get("/onespotpair/:id", adminAuth.verifyToken, adminGetmethods.adminonespotpair);
router.post("/updatespotpair", adminAuth.verifyToken, adminGetmethods.adminupdatespotpair);
router.get("/admin-moveHistory", adminAuth.verifyToken, adminController.adminMoveHistory);
router.post('/sendPushNotification', adminAuth.verifyToken,adminController.sendPushNotification);
router.get("/getcoinfeesetting", adminAuth.verifyToken,adminController.getcoinfeesetting);
router.get("/getuser-assets", adminAuth.verifyToken, adminGetmethods.getUserAssets);
router.get("/user-depositCount", adminAuth.verifyToken, adminGetmethods.userDepositCount);
router.get("/user-fiat-crypto-order", adminAuth.verifyToken, adminGetmethods.getFiatAndCryptoHistory);
router.get("/fiat-currencies", adminAuth.verifyToken,Transak.fiatcurrencies);
router.post("/site-setting", uploads.single('logo'), adminAuth.verifyToken, adminController.updateSiteSetting);
router.get("/get-site-setting", adminAuth.verifyToken, adminController.getSiteSetting); 
router.get("/get-CopyrightsData", adminController.getCopyRightsData); 
router.get("/get-TermspageData", adminController.getTermspageData);


// subAdmin routes 
router.post("/create-subAdmin", adminAuth.verifyToken, SubAdminController.CreateSubAdmin);
router.get("/get-subAdmin", adminAuth.verifyToken, SubAdminController.getSubAdmin);
router.put("/edit-subAdmin/:id", adminAuth.verifyToken, SubAdminController.UpdateSubAdmin);
router.get("/getOneUserData/:id", adminAuth.verifyToken, SubAdminController.getOneUserEditData);  
router.delete("/delete-subAdmin/:id", adminAuth.verifyToken, SubAdminController.deleteSubAdmin);   
// subadmin login view and edit response route
router.get("/view-edit-GetData", adminAuth.verifyToken, SubAdminController.subAdminGetData);  
router.post("/admin-activestatus/:id", adminAuth.verifyToken, SubAdminController.activeDeactiveSubAdmin);  
// get admin activity data 
router.get("/admin-activity", adminAuth.verifyToken, SubAdminController.adminActivityGetData); 

// Support Ticket
router.post('/create-issue',adminAuth.verifyToken, SupportTicketAdminController.createIssue);
router.get("/viewtickets",adminAuth.verifyToken, SupportTicketAdminController.viewTicket);
router.get("/viewtickets/:id" ,adminAuth.verifyToken,SupportTicketAdminController.viewTicketOne);
router.post("/reply",adminAuth.verifyToken,securityAuth.encMiddleWare,  SupportTicketAdminController.replayTicket);
router.post("/closeticket" ,adminAuth.verifyToken,securityAuth.encMiddleWare, SupportTicketAdminController.closeTicket);
router.get("/viewissue" ,adminAuth.verifyToken,SupportTicketAdminController.viewIssue);
router.get("/deleteissue/:id" ,adminAuth.verifyToken,SupportTicketAdminController.deleteIssue);
router.get('/get-tickets' ,adminAuth.verifyToken, SupportTicketAdminController.getAllTickets);
router.post('/fileUpload', uploads.array("images[]"), SupportTicketAdminController.updateImages); 
// ....................2fa disable in adminpanel........... 

router.post('/2fa-adminDisable',adminAuth.verifyToken, SubAdminController.TfaDisablePageData ); 



module.exports = router;    
