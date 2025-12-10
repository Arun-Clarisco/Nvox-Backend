const adminUser = require("../../Modules/adminModule/AdminModule");
const CryptoJS = require("crypto-js");
const Config = require("../../Config/config");
const nodemailer = require("nodemailer");
const hbs = require("nodemailer-express-handlebars");
const path = require("path");
const subadminactvityDb = require("../../Modules/adminModule/AdminActivity");
const axios = require("axios");
const { encryptData, decryptData } = require("../../Config/Security");
const UserDb = require("../../Modules/userModule/userModule");
const { findById, findByIdAndUpdate } = require("../../Modules/SupportTicket");
const mongoose = require("mongoose");


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

class subAdminMethods {
  adminActivity = async (
    req,
    ip,
    typelog,
    adminEmail,
    adminName,
    lastId,
    commentlog
  ) => {
    // console.log(req, typelog, lastId, commentlog);
    try {
      let browserlog = "";
      if (req && req.headers["user-agent"]) {
        let ua = req.headers["user-agent"].toLowerCase();
        // console.log("ua", ua);

        if (/edg/i.test(ua)) {
          browserlog = "Edge";
        } else if (/firefox/i.test(ua)) {
          browserlog = "Firefox";
        } else if (/chrome/i.test(ua)) {
          browserlog = "Chrome";
        } else if (/safari/i.test(ua)) {
          browserlog = "Safari";
        } else if (/msie/i.test(ua)) {
          browserlog = "msie";
        } else {
          browserlog = ua;
        }
      }

      //  ......correcct code
      // const address = await axios.get("https://api.ipify.org/?format=json");

      // const lastloginIpAddress = address.data.ip;
      // console.log("lastloginIpAddress", lastloginIpAddress);
      //  ......correcct code

      const adminlogdata = {
        ip: ip,
        browser: browserlog,
        type: typelog,
        AdminEmail: adminEmail,
        AdminName: adminName,
        lastId: lastId,
        comment: commentlog,
      };

      // ✅ Insert directly into MongoDB
      let admininsertdata;
      admininsertdata = await subadminactvityDb.create(adminlogdata);
      // console.log("admininsertdata", admininsertdata);

      return true;
    } catch (err) {
      console.log("AdminActivityLog error --", err);
      return false;
    }
  };

  CreateSubAdmin = async (req, res) => {
    try {
      const adminId = res.locals.admin_id;
      if (adminId) {
        const createAdmin = await adminUser.findOne({ _id: adminId });
        const { email, adminPermissions, adminName, ip } = req.body;
        // console.log("permissions---", adminPermissions);

        const existingAdmin = await adminUser.findOne({ email: email });
        let subAdminCreateencryptRes;
        if (existingAdmin) {
          subAdminCreateencryptRes = encryptData({
            status: false,
            message: "Sub-admin already exists.",
          });
          // 🟢 Stop execution here
          return res.send({ data: subAdminCreateencryptRes });
        }

        // create SubAdmin
        const CreateSubAdmin = new adminUser({
          adminName,
          email,
          admin_type: "SubAdmin",
          adminPermissions: adminPermissions,
        });

        const SubAdminSaveData = await CreateSubAdmin.save();
        // console.log("SubAdminSaveData---", SubAdminSaveData);

        // this is call method abvoe adminactivity
        const adminactivityLog = await this.adminActivity(
          req,
          ip,
          "SubAdmin Create",
          createAdmin.email,
          createAdmin.admin_type,
          SubAdminSaveData.email,
          "SubAdmin created successfully!"
        );
        // console.log("adminactivityLog", adminactivityLog);

        // 🟢 If SubAdmin created successfully, send forgot password mail
        // 🟢 Forgot Password Link (Reset அல்ல)
        const forgotLink = `${Config.AdminPanel_URl}/forgot-password`;

        // 🟢 Mail Body
        const emailBody = `
      <p>Hi ${SubAdminSaveData.adminName},</p>
      <p>Your  account has been created successfully.</p>
      <p>To set your password, please go to the forgot password page:</p>
      <a href="${forgotLink}" target="_blank">${forgotLink}</a> 
      <br />
      <p>Then enter your email and follow the steps to reset your password.</p>
    `;

        // 🟢 Mail Send
        await forgetPassMailSend(
          SubAdminSaveData.email,
          "Account Creation Mail Notification",
          emailBody
        );

        if (SubAdminSaveData) {
          subAdminCreateencryptRes = encryptData({
            status: true,
            message: "SubAdmin created successfully.",
            data: SubAdminSaveData,
            emailBody: emailBody,
          });
        } else {
          subAdminCreateencryptRes = encryptData({
            status: false,
            message: "Failed to create SubAdmin.",
          });
        }
        // console.log("subAdminCreateencryptRes", subAdminCreateencryptRes);

        // return res.send({
        //   status: true,
        //   message: "SubAdmin created successfully.",
        //   data: SubAdminSaveData,
        //   emailBody: emailBody,
        // });
        return res.send({ data: subAdminCreateencryptRes });
      } else {
        subAdminCreateencryptRes = encryptData({
          status: false,
          message: "Something went wrong..! Please Try again Later",
        });
        return res.send({ data: subAdminCreateencryptRes });
      }
    } catch (error) {
      console.error("Error creating SubAdmin:", error);
      const subAdminCreateencryptRes = encryptData({
        status: false,
        message: "Something went wrong..! Please Try again Later",
      });
      return res.send({ data: subAdminCreateencryptRes });
    }
  };
  getSubAdmin = async (req, res) => {
    try {
      const page = parseInt(req.query.page);
      const limit = parseInt(req.query.limit);
      const skip = (page - 1) * limit;
      // console.log("skip", skip);
      const search = req.query.search || "";
      const status = req.query.status || ""; // "Active" அல்லது "Inactive"

      let query = { admin_type: "SubAdmin" };

      if (search) {
        query.$or = [
          { adminName: { $regex: search, $options: "i" } },
          { email: { $regex: search, $options: "i" } },
        ];
      }
      // console.log("search", search);

      if (status) {
        query.active_status = status;
      }
      // console.log("status", status);

      // console.log("query", query);

      const subAdminData = await adminUser
        .find(query)
        .skip(skip)
        .limit(limit)
        .sort({ _id: -1 })
        .exec();
      const total = await adminUser.countDocuments({ admin_type: "SubAdmin" });

      // console.log("subAdminData---", subAdminData);

      return res.send({
        status: true,
        data: subAdminData,
        total,
        page,
        limit,
      });
    } catch (error) {
      return res.status(500).send({
        status: false,
        message: "Something went wrong..!",
      });
    }
  };
  UpdateSubAdmin = async (req, res) => {
    try {
      const adminId = res.locals.admin_id;
      if (adminId) {
        const updateadmin = await adminUser.findById({ _id: adminId });
        // console.log("updateadmin", updateadmin);

        const { id } = req.params;
        // console.log("editid---", id);

        const { email, adminPermissions, ip } = req.body;
        // console.log("req.body;---", req.body);

        const findSubAdmin = await adminUser.findOne({ _id: id });
        // console.log("findSubAdmin---", findSubAdmin);

        if (!findSubAdmin) {
          return res
            .status(404)
            .json({ status: false, message: "SubAdmin not found" });
        }
        // const updateData = {
        //   email,

        //   adminPermissions,
        // };
        // const updatedAdmin = await adminUser.findByIdAndUpdate(id, updateData, {
        //   new: true,
        // });

        const updatedAdminData = await adminUser.findByIdAndUpdate(
          id,
          { $set: { adminPermissions } },
          { new: true }
        );
        let finalDescription = "edited: (No Access)"; // default

        let hasView = false;
        let hasEdit = false;

        for (const perms of Object.values(adminPermissions)) {
          let view = perms.View ?? 0;
          let edit = perms.Edit ?? 0;

          if (view === 1) hasView = true;
          if (edit === 1) hasEdit = true;
        }

        if (hasView && hasEdit) {
          finalDescription = "edited: (View & Edit)";
        } else if (hasView) {
          finalDescription = "edited: (View Only)";
        } else if (hasEdit) {
          finalDescription = "edited: (Edit Only)";
        }

        // ✅ activity log
        const editAdminactivityLog = await this.adminActivity(
          req,
          ip,
          "SubAdmin Update",
          updateadmin.email, // superadmin email
          updateadmin.admin_type, // superadmin type
          updatedAdminData.email, // subadmin email
          `subadmin Updated successfully ${finalDescription}`
        );

        // update admin activity load
        //  const editAdminactivityLog = await this.adminActivity(
        //     req,
        //     "SubAdmin Create",
        //     updateadmin.email,
        //     updateadmin.admin_type,
        //     updatedAdminData.email,
        //     "SubAdmin created successfully!"
        //   );

        // console.log("editSubadminEncryptRes", editAdminactivityLog);
        // if(editAdminactivityLog){

        // }else{

        // }
        let editSubadminEncryptRes;
        if (editAdminactivityLog) {
          editSubadminEncryptRes = encryptData({
            status: true,
            message: "SubAdmin updated successfully",
            data: updatedAdminData,
          });
        } else {
          editSubadminEncryptRes = encryptData({
            status: false,
            message: "Failed to update SubAdmin!",
            data: updatedAdminData,
          });
        }

        // console.log("editSubadminEncryptRes", editSubadminEncryptRes);
        if (editSubadminEncryptRes) {
          return res.send({
            data: editSubadminEncryptRes,
          });
        } else {
          return res.send({
            data: editSubadminEncryptRes,
          });
        }
      } else {
        editSubadminEncryptRes = encryptData({
          status: false,
          message: "Something went wrong..! Please Try again Later",
          data: updatedAdminData,
        });
      }
    } catch (error) {
      return res.send({
        status: false,
        message: "Something went wrong..!",
      });
    }
  };
  getOneUserEditData = async (req, res) => {
    try {
      const { id } = req.params;
      // console.log("id---", id);

      const OneuserEditData = await adminUser.findOne({ _id: id });
      // console.log("userData---", OneuserEditData);

      if (!OneuserEditData) {
        return res
          .status(404)
          .json({ status: false, message: "User not found" });
      }

      return res.send({
        status: true,
        data: OneuserEditData,
      });
    } catch (error) {
      console.error(error);
      return res.status(500).send({
        status: false,
        message: "Something went wrong..!",
      });
    }
  };
  //............. delete functionality.................// 
  deleteSubAdmin = async (req, res) => {
    try {
      const adminId = res.locals.admin_id;
      const { id } = req.params;
      const ip = req.body.ip;
      //console.log("IP from frontend:", ip);

      if (!id) {
        return res.send({
          status: false,
          message: "Invalid Admin Credentials...",
        });
      }

      const adminTypeData = await adminUser.findById({ _id: adminId });
      //console.log("adminTypeData", adminTypeData);
      // return;
      const deleteSubAdmin = await adminUser.findByIdAndDelete(id);
      // console.log("deleted---", deleteSubAdmin);
      if (adminTypeData.admin_type == "SuperAdmin") {
        const deleteAdminActivity = await this.adminActivity(
          req,
          ip,
          "SubAdmin Delete",
          adminTypeData.email, // superadmin email
          adminTypeData.admin_type,
          deleteSubAdmin.email,
          `Subadmin has been deleted successfully`
        );
      }
      return res.send({
        status: true,
        message: "Sub Admin deleted successfully",
        deleteSubAdmin,
      });
    } catch (error) {
      console.error("DeleteSubAdmin error:", error);
      res
        .send({ status: false, message: "Error deleting Sub Admin" });
    }
  };  

  //............. login user get data response...........
 
  subAdminGetData = async (req, res) => {
    try {
      const subAdminId = res.locals.admin_id;
      // console.log("subAdminId---", subAdminId);

      if (subAdminId && subAdminId !== null) {
        const subAdminData = await adminUser.findOne({ _id: subAdminId });
        // console.log("subAdminData---", subAdminData);
        // return;
        return res.send({ status: true, data: subAdminData });
      } else {
        return res.send({
          status: false,
          message: "Authorization failed. Please log in again",
        });
      }
    } catch (error) {
      console.error("subAdminGetData error:", error);
      res.send({ status: false, message: "Something Went Wrong" });
    }
  };
  // active / deactive functionality code
  activeDeactiveSubAdmin = async (req, res) => {
    try {
      const adminId = res.locals.admin_id;
      const adminTypeData = await adminUser.findById({ _id: adminId });
      // console.log("adminTypeData", adminTypeData);

      const { id } = req.params;

      const { activestatus, ip } = req.body;

      if (!id) {
        return res.send({
          status: false,
          message: "Invalid Admin Credentials...",
        });
      }
      const findAdmin = await adminUser.findOne({ _id: id });
      // console.log("findAdmin---", findAdmin);
      if (findAdmin) {
        const adminActiveStatus =
          activestatus === "Active" ? "Active" : "Inactive";
        // console.log('adminActiveStatus', adminActiveStatus);
        const updateStatus = await adminUser.findByIdAndUpdate(
          id,
          { $set: { active_status: adminActiveStatus } },
          { new: true }
        );
        const activeAdminActivity = await this.adminActivity(
          req,
          ip,
          "SubAdmin Update",
          adminTypeData.email, // superadmin email
          adminTypeData.admin_type,
          updateStatus.email,
          `subadmin  ${activestatus}  successfully`
        );
        let activestatusEncryptRes;
        if (updateStatus) {
          activestatusEncryptRes = encryptData({
            status: true,
            message: "SubAdmin status changed successfully",
            data: updateStatus,
          });
        } else {
          activestatusEncryptRes = encryptData({
            status: false,
            message: "Failed to change status",
          });
        }

        return res.send({ data: activestatusEncryptRes });
      }

      // console.log("updateStatus---", updateStatus);
      // return res.send({
      //   status: true,
      //   message: `Sub Admin status changed successfully.`,
      //   data: updateStatus,
      // });
    } catch (error) {
      console.log("err", error);
      return res
        .status(500)
        .send({ status: false, message: "Error changing Sub Admin status" });
    }
  };
  // superadmin and subadmin activity

  adminActivityGetData = async (req, res) => {
    try {
      const page = parseInt(req.query.page);
      //console.log("page", page);

      const limit = parseInt(req.query.limit);
      // console.log("limit", limit);
      //
      const skip = (page - 1) * limit;
      const startDate = req.query.startDate;
      // console.log("startDate-----", startDate);

      const endDate = req.query.endDate;
      // console.log("endDate-----", endDate);

      let sortOrder = req.query.sortOrder;
      // console.log("sortOrder-----", sortOrder, "typeof", typeof sortOrder);

      if (sortOrder) {
        if (sortOrder == 1) {
          sortOrder = 1;
        } else {
          // console.log("work");
          sortOrder = -1;
        }
      }
      // console.log("sortOrderAfer>>>", sortOrder);
      const search = (req.query.search || "").trim();
      // console.log("search>>>", search);

      const status = req.query.status || "";
      const type = req.query.type || "";
      // console.log("type>>", type);
      let query = {};
      if (search) {
        query.$or = [
          { AdminName: { $regex: search, $options: "i" } },
          { AdminEmail: { $regex: search, $options: "i" } },
        ];
      }

      // console.log("search", search);

      // if (status) {
      //   query.active_status = status;
      // }
      if (type) {
        query.type = type;
      }
      if (startDate && endDate) {
        // console.log("startDate-----", startDate);
        // console.log("endDate-----", endDate);
        const start = new Date(`${startDate}T00:00:00.000Z`);
        const end = new Date(`${endDate}T23:59:59.999Z`);

        query.dateTime = {
          // $gte: new Date(new Date(startDate).setHours(0, 0, 0, 0)),
          // $lte: new Date(new Date(endDate).setHours(23, 59, 59, 999)),
          $gte: start,
          $lte: end,
        };
      }
      // console.log("startDate", startDate);
      // console.log("endDate", endDate);

      // console.log("query", query);

      //console.log("skip", skip);
      const adminactivityData = await subadminactvityDb
        .find(query)
        .skip(skip)
        .limit(limit)
        .sort({ dateTime: sortOrder });

      // console.log("adminactivityData>>>>", adminactivityData);

      const total = await subadminactvityDb.countDocuments(query);

      // console.log("total---", total);
      
      return res.send({
        status: true,
        data: adminactivityData,
        total,
        page,
        limit,
      });
    } catch (err) {
      console.log("err", err);
      return res.send({ status: false, message: "Something went wrong!.." });
    }
  };
  TfaDisablePageData = async (req, res) => {
    try {
      const adminId = res.locals.admin_id;
      const adminData = await adminUser.findById({ _id: adminId });
      // console.log("adminData", adminData);
      
      const { userId, lastloginIpAddress } = req.body;
      const objectUserId = new mongoose.Types.ObjectId(userId); 
     // console.log("objectUserId", objectUserId); 
      
       
      const TfaUserData = await UserDb.findOne({ _id: objectUserId });
     // console.log("TfaUserData", TfaUserData);  

      let adminTfaDisableEncrypt;

      if (TfaUserData.TFAEnableKey != "" && TfaUserData.TFAStatus == false) {
        const TfaDisableUpdate = await UserDb.findByIdAndUpdate(
          { _id: TfaUserData._id },
          {
            $set: {
              TFAEnableKey: "",
              TFAStatus: true,
              adminDisableStatus: 2,
            },
          },
          { new: true }
        );
        // console.log("TfaDisableUpdate", TfaDisableUpdate);
        //   const emailBody = `
        //   <p>Hello ${TfaDisableUpdate.first_name},</p>
        //   <p>Your 2FA verification has been disabled by Admin.</p>
        //   <p>If this was not done by you, please contact support immediately.</p>
        // `;
        const emailBody = `
        <div style="font-family: Arial, sans-serif; line-height: 1.6;">
        <div style="text-align: center;">
        <img src="${Config.Cloudinary_logo}" alt="Company Logo" 
           style="width:150px; height:auto; margin-bottom: 20px;" />
           </div>
         <div style="text-align: left;">
           <p>Hello ${TfaDisableUpdate.first_name},</p>
           <p>Your 2FA verification has been <strong>disabled by Admin</strong>.</p>
           <p>If you have any queries or concerns, please contact the admin immediately</p>
         </div>
        </div>
        `;

        forgetPassMailSend(
          TfaDisableUpdate.email,
          "2FA Disabled Notification",
          emailBody
        );
        let adminTfaDisableAcitivity;

        if (adminData.admin_type == "SuperAdmin") {
          adminTfaDisableAcitivity = await this.adminActivity(
            req,
            lastloginIpAddress,
            "TFA Disable",
            adminData.email,
            adminData.admin_type,
            TfaDisableUpdate.email,
            `${TfaUserData.email} user's TFA has been disabled.`
          );
        } else if (adminData.admin_type == "SubAdmin") {
          adminTfaDisableAcitivity = await this.adminActivity(
            req,
            lastloginIpAddress,
            "TFA Disable",
            adminData.email,
            adminData.adminName,
            TfaDisableUpdate.email,
            `${TfaUserData.email} user's TFA has been disabled.`
          );
        }
        adminTfaDisableEncrypt = encryptData({
          status: true,
          message: "The user's 2FA is now disabled.",
          TfaDisableUpdate,
          userData: TfaUserData,
        });
      } else {
        adminTfaDisableEncrypt = encryptData({
          status: false,
          message: "Failed to disable the user's 2FA.",
        });
      }
      return res.send({ data: adminTfaDisableEncrypt });
    } catch (err) {
      console.error(err);
      adminTfaDisableEncrypt = encryptData({
        status: false,
        message: "something went wrong!..",
        TfaDisableUpdate,
      });
      return res.send({ data: adminTfaDisableEncrypt });
    }
  };
}

module.exports = new subAdminMethods();
