const config = require("../Config/config");
const Web3 = require("web3");
const mongoose = require("mongoose");
const CoinAddress = require("../Modules/userModule/CoinAddress");
const jsonrpc = require("../Config/rpcUrl");
let fs = require("fs");
const path = require("path");
const primaryConfig = config.primarySmtp;
const nodemailer = require("nodemailer");
const hbs = require("nodemailer-express-handlebars");
const Transaction = require("../Modules/userModule/Transaction");
const axios = require("axios");
const AdminSettings = require("../Modules/adminModule/AdminSettings");
const {
  decryptionKey,
  userHistory,
  rejectUserRequest,
  userDepositUpdate,
  currencyData,
  adminHistory,
} = require("../Controllers/adminControllers/adminController");
const ObjectId = mongoose.Types.ObjectId;
let nodeUrl = jsonrpc.ethconfig.host;
let provider = new Web3.providers.HttpProvider(nodeUrl);
const web3 = new Web3(provider);
const APIUrl = jsonrpc.ethconfig.APIUrl;
const Apikey = jsonrpc.ethconfig.Apikey;
const usdt_abi = require("../Config/usdtAbi");
const Coindata = require("../Modules/userModule/pairData");
const {
  adminMovedStatus,
} = require("../Controllers/userControllers/userController");
const subAdminMethods = require("../Controllers/adminControllers/SubAdminController");
const adminUser = require("../Modules/adminModule/AdminModule");
const UserDb = require("../Modules/userModule/userModule");
const approveEmail = path.resolve(
  __dirname,
  "../Controllers/EmailTemplates/mailBody/approveWithdraw.txt"
);

const depositMail = path.resolve(
  __dirname,
  "../Controllers/EmailTemplates/mailBody/depositMail.txt"
);

const siteSetting = require("../Modules/adminModule/SiteSetting");

const { SendMailClient } = require("zeptomail");

const zepto_url = config.ZEPTOMAIL_URL;
const zepto_token = config.ZEPTOMAIL_TOKEN;

const mail_Client = new SendMailClient({ url: zepto_url, token: zepto_token });

const transporter = nodemailer.createTransport({
  host: `${config.SMTP_Host}`,
  port: 465,
  secure: true, //ssl
  auth: {
    user: `${config.mailCredUserName}`,
    pass: `${config.mailCredPassword}`,
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

const PassMailSend = async (to, subject, emailBody) => {
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

// const PassMailSend = (to, sub, emailBody) => {
//   try {
//     let mailOptions = {
//       from: `${config.mailFromAddress1}`,
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

function getUnique(arr, index) {
  const unique = arr
    .map((e) => e[index])
    .map((e, i, final) => final.indexOf(e) === i && i)
    .filter((e) => arr[e])
    .map((e) => arr[e]);
  return unique;
}

exports.ETHCreateAddress = async (userid) => {
  // const userid = res.locals.user_id
  // console.log('userid', userid)
  let existingAddress = await CoinAddress.findOne({
    user_id: new ObjectId(userid),
    currencyname: "ETH",
  });
  if (existingAddress) {
    return existingAddress;
  }
  const account = web3.eth.accounts.create();
  const walletPrivate = account.privateKey;
  const walletAddress = account.address;
  const encryptionPassword = jsonrpc.ethconfig.UserKey;
  const keystore = web3.eth.accounts.encrypt(walletPrivate, encryptionPassword);
  const baseDir = path.join(__dirname, "../Keystore");

  try {
    if (!fs.existsSync(baseDir)) {
      fs.mkdirSync(baseDir, { recursive: true });
    }
    const filePath = path.join(baseDir, walletAddress.toLowerCase() + ".json");
    await fs.promises.writeFile(filePath, JSON.stringify(keystore), "utf8");

    const newAddress = new CoinAddress({
      user_id: userid,
      address: walletAddress,
      currencyname: "ETH",
      encData: JSON.stringify(keystore),
    });

    await newAddress.save();

    return newAddress;
  } catch (err) {
    console.log("ETH CreateAddress : err : ", err);
  }
};

exports.EthDeposit = async (userId, symbol) => {
  try {

    const userData = await UserDb.findById({ _id: userId });
    // console.log("userData", userData);

    const address_det = await CoinAddress.findOne({
      user_id: userId,
      currencyname: "ETH",
    });
    if (!address_det) {
      return { success: false, message: "No ETH address found", count: 0 };
    }

    let account = address_det.address;
    // console.log("account", account);
    let previousBlock =
      symbol == "ETH"
        ? address_det.ethBlock.eth
        : address_det.ethBlock.token || 0;
    let startBlock = previousBlock > 10000 ? previousBlock - 10000 : 0;
    // console.log("previousBlock", previousBlock);

    if (symbol === "ETH") {
      reqUrl = `${APIUrl}&module=account&action=txlist&address=${account}&startblock=${startBlock}&endblock=latest&apikey=${Apikey}`;
    } else {
      reqUrl = `${APIUrl}&module=account&action=tokentx&contractaddress=${jsonrpc.ethconfig.Usdt_token}&address=${account}&endblock=latest&apikey=${Apikey}`;
    }

    const response = await axios.get(reqUrl);
    // console.log("usdtdespoti", response.data.result);

    if (!response.data.result || response.data.result.length === 0) {
      return {
        success: false,
        message: `No new ${symbol} deposits found`,
        count: 0,
      };
    }

    const adminAddresses = await AdminSettings.find({}, "evm_address");
    const adminAddressSet = new Set(
      adminAddresses.map((a) => a.evm_address?.toLowerCase()).filter(Boolean)
    );

    let transactions = response.data.result.filter(
      (tx) =>
        tx.blockNumber >= previousBlock &&
        tx.to.toLowerCase() === account.toLowerCase() &&
        !adminAddressSet.has(tx.from.toLowerCase())
    );

    if (transactions.length === 0) {
      return {
        success: false,
        message: `No new ${symbol} deposits found`,
        count: 0,
      };
    }

    let maxProcessedBlock = previousBlock;
    let newDepositCount = 0;

    for (let tx of transactions) {
      let txid = tx.hash;

      // check if already processed
      let existingTxn = await Transaction.findOne({
        txnId: txid,
        type: "Deposit",
      });
      if (existingTxn) continue;

      // calculate values
      let amount = tx.value / 1e18;
      let createdDate = new Date(Number(tx.timeStamp) * 1000);
      const Symbol = symbol === "USDT" ? "USDT" : symbol + "USDT";
      let coinData = await Coindata.findOne({ symbol: Symbol });
      let currentPrice = coinData?.current_price || 0;
      let usdAmount = parseFloat(currentPrice) * parseFloat(amount);

      // save transaction
      let depositData = {
        userId,
        toaddress: tx.to,
        amount,
        fromAddress: tx.from,
        fees: "",
        type: "Deposit",
        txnId: txid,
        status: 1,
        moveCur: symbol,
        currentDeposit_livePrice: currentPrice,
        usdAmount,
        createdDate,
      };

      const newTxn = new Transaction(depositData);
      const savedTxn = await newTxn.save();

      if (savedTxn) {
        await userDepositUpdate(userId, amount, symbol);
        newDepositCount++;

        const datas = fs.readFileSync(depositMail, "utf8");
        let bodyData = datas.toString();
        const getSitesetting = await siteSetting.findOne({});
        const userName = userData.first_name || userData.email;
        const emailCotent = `Your deposit of ${amount} ${symbol} has been successfully received and updated in your account.`;
        const logoPosition = getSitesetting?.logoPosition || "center";
        const copyright =
          getSitesetting?.copyright ||
          "© 2025 Rempic. All rights reserved.";
        const chars = {
          "{{UserName}}": userName,
          "{{logoPosition}}": logoPosition,
          "{{compName}}": copyright,
          "{{compImage}}": `${config.Cloudinary_logo}`,
          "{{EmailContent}}": emailCotent,
          "{{TxnId}}": txid,
        };
        let emailBody = bodyData;
        for (const key in chars) {
          emailBody = emailBody.replace(new RegExp(key, "g"), chars[key]);
        }
        let subject = `New ${symbol} Deposit Received`;
        await PassMailSend(userData.email, subject, emailBody);
        maxProcessedBlock = Math.max(maxProcessedBlock, tx.blockNumber);
      }
    }

    if (maxProcessedBlock > previousBlock) {
      if (symbol == "ETH") {
        await CoinAddress.updateOne(
          { user_id: userId, currencyname: "ETH" },
          { $set: { "ethBlock.eth": maxProcessedBlock } }
        );
      } else {
        await CoinAddress.updateOne(
          { user_id: userId, currencyname: "ETH" },
          { $set: { "ethBlock.token": maxProcessedBlock } }
        );
      }
    }

    if (newDepositCount > 0) {
      return {
        success: true,
        message: `${symbol} recent deposit updated successfully`,
        count: newDepositCount,
      };
    } else {
      return {
        success: false,
        message: `No new ${symbol} deposits found`,
        count: 0,
      };
    }
  } catch (error) {
    console.error("CoinDeposit Error:", error);
    return { success: false, message: "Internal Error", count: 0 };
  }
};

// exports.EthDeposit = async (userId, symbol) => {
//   try {
//     const address_det = await CoinAddress.findOne({ user_id: userId, currencyname: "ETH" })
//     if (!address_det) {
//       return false;
//     }

//     let account = address_det.address;
//     let previousBlock = address_det.ethBlock.eth || 0;
//     let startBlock = previousBlock > 10000 ? previousBlock - 10000 : 0;

//     let reqUrl;
//     if (symbol == "ETH") {
//       reqUrl = `${APIUrl}?module=account&action=txlist&address=${account}&startblock=${startBlock}&endblock=latest&apikey=${Apikey}`
//     } else {
//       reqUrl = `${APIUrl}?module=account&action=tokentx&contractaddress=${jsonrpc.ethconfig.Usdt_token}&address=${account}&endblock=latest&apikey=${Apikey}`;
//     }
//     const response = await axios.get(reqUrl);
//     if (!response.data.result || response.data.result.length === 0) {
//       return false;
//     }

//     const adminAddresses = await AdminSettings.find({}, 'evm_address');

//     const adminAddressSet = new Set(adminAddresses.map(a => a.evm_address?.toLowerCase()).filter(Boolean));
//     let transactions = response.data.result.filter(tx =>
//       tx.blockNumber >= previousBlock &&
//       tx.to.toLowerCase() === account.toLowerCase() &&
//       !adminAddressSet.has(tx.from.toLowerCase())
//     );
//     if (transactions.length === 0) {
//       return false;
//     }
//     let maxProcessedBlock = previousBlock;

//     for (let i = 0; i < transactions.length; i++) {
//       let tx = transactions[i];
//       let block_number = tx.blockNumber;
//       let toAddress = tx.to;
//       let fromAddress = tx.from;
//       let txid = tx.hash;
//       let value = tx.value;
//       let createdDate = new Date(Number(tx.timeStamp) * 1000);
//       let amount = value / 1e18;

//       let existingTxn = await Transaction.findOne({ txnId: txid, type: "Deposit" });
//       if (existingTxn) {
//         console.log('Transaction already recordedd:', txid);
//         continue;
//       }
//       const Symbol = symbol === "USDT" ? "USDT" : symbol + "USDT"
//       let coinData = await Coindata.findOne({ symbol: Symbol });
//       let currentPrice = coinData?.current_price || 0;
//       let usdAmount = parseFloat(currentPrice) * parseFloat(amount);

//       let depositData = {
//         userId: userId,
//         toaddress: toAddress,
//         amount: amount,
//         fromAddress: fromAddress,
//         fees: "",
//         type: "Deposit",
//         txnId: txid,
//         status: 1,
//         moveCur: symbol,
//         currentDeposit_livePrice: currentPrice,
//         usdAmount: usdAmount,
//         createdDate: createdDate
//       };
//       const TrasactionDetail = new Transaction(depositData);
//       const siteData = await TrasactionDetail.save();
//       if (siteData.status) {
//         await userDepositUpdate(userId, amount, symbol);
//         maxProcessedBlock = Math.max(maxProcessedBlock, block_number);
//       }

//     }
//     if (maxProcessedBlock > previousBlock) {
//       await CoinAddress.updateOne(
//         { user_id: userId, currencyname: "ETH" },
//         { $set: { "ethBlock.eth": maxProcessedBlock } }
//       );
//     }
//     return true;
//   } catch (error) {
//     console.error('CoinDeposit Error:', error);
//     return false;
//   }
// }

// withdraw

exports.EthWithdraw = async (userId, data, req) => {
  // const adminId = res.locals.id;
  // const adminData = await adminUser.findOne({ _id: adminId});
  // console.log("adminData", adminData);

  try {
    const adminId = userId;
    const adminData = await adminUser.findOne({ _id: adminId });
    ///console.log("adminData", adminData);

    let adminAddress;

    if (data.type == "approve") {
      if (adminId && adminData.admin_type == "SuperAdmin") {
        adminAddress = await AdminSettings.findOne(
          { userId: userId },
          { evm_address: 1, evm_key: 1 }
        );
      } else {
        adminAddress = await AdminSettings.findOne({});
        // console.log("adminAddress>>>>>", adminAddress);

      }

      // console.log("adminAddress>>>>>>", adminAddress);

      let adminKey = await decryptionKey(adminAddress?.evm_key);
      // console.log("adminKey", adminKey);

      const adminBalance = await web3.eth.getBalance(adminAddress.evm_address);
      // console.log("adminBalance", adminBalance);

      const EthBalance = web3.utils.fromWei(adminBalance, "ether");
      // console.log("EthBalance", EthBalance);

      const roundedAmount = Number(data.amount).toFixed(18);
      //    console.log("roundedAmount", roundedAmount);

      const transferAmount = web3.utils.toWei(
        roundedAmount.toString(),
        "ether"
      );
      // console.log("transferAmount", transferAmount);

      let signed;

      if (data.symbol == "ETH") {
        if (parseFloat(EthBalance) > parseFloat(data.amount)) {
          signed = await coinTransfer(
            adminAddress.evm_address,
            adminKey,
            data.toaddress,
            transferAmount
          );
        } else {
          return { status: false, message: "Insufficient Admin Balance" };
        }
      } else {
        let usdt_Bal = new web3.eth.Contract(
          usdt_abi,
          jsonrpc.ethconfig.Usdt_token
        );
        let totalBUSDT_BAL = await usdt_Bal.methods
          .balanceOf(adminAddress.evm_address)
          .call();
        let USDT_balance = web3.utils.fromWei(totalBUSDT_BAL);
        let transferAmt = web3.utils.toWei(data.amount.toString(), "ether");

        if (parseFloat(USDT_balance) > parseFloat(data.amount)) {
          const transferData = await usdt_Bal.methods
            .transfer(data.toaddress, transferAmt)
            .encodeABI();
          signed = await tokenTransfer(
            adminAddress.evm_address,
            adminKey,
            transferData
          );
        } else {
          return { status: false, message: "Insufficient Admin Balance" };
        }
      }
      if (signed && signed.transactionHash) {
        const EthBalanceData = await userHistory(
          data.id,
          adminAddress.evm_address,
          signed.transactionHash,
          2
        );
        // console.log("EthBalanceData", EthBalanceData);
        const withdrawUserData = await UserDb.findById({
          _id: EthBalanceData.userId,
        }).exec();
        // console.log("withdrawUserData", withdrawUserData);
        if (adminData.admin_type == "SuperAdmin") {
          const EthadminActivity = await subAdminMethods.adminActivity(
            req,
            data.ip,
            "withdrawRequest",
            adminData.email,
            adminData.admin_type,
            withdrawUserData.email,
            `${EthBalanceData.moveCur} Withdrawal Request Approved Successfully!`
          );
        } else {
          const EthadminActivity = await subAdminMethods.adminActivity(
            req,
            data.ip,
            "withdrawRequest",
            adminData.email,
            adminData.adminName,
            withdrawUserData.email,
            `${EthBalanceData.moveCur} Withdrawal Request Approved Successfully!`
          );
        }

        ///console.log("EthadminActivity", EthadminActivity);

        const datas = fs.readFileSync(approveEmail, "utf8");
        let bodyData = datas.toString();
        const getSitesetting = await siteSetting.findOne({});
        const emailCotent = `Your ${data.amount} ${EthBalanceData.moveCur} withdraw request Approved Successfully!`;
        const logoPosition = getSitesetting?.logoPosition || "center";
        const copyright =
          getSitesetting?.copyright ||
          "© 2025 Rempic. All rights reserved.";
        const chars = {
          "{{logoPosition}}": logoPosition,
          "{{compName}}": copyright,
          "{{compImage}}": `${config.Cloudinary_logo}`,
          "{{EmailContent}}": emailCotent,
        };
        bodyData = bodyData.replace(/{{logoPosition}}/i, (m) => chars[m]);
        bodyData = bodyData.replace(/{{compName}}/i, (m) => chars[m]);
        bodyData = bodyData.replace(/{{compImage}}/i, (m) => chars[m]);
        bodyData = bodyData.replace(/{{EmailContent}}/i, (m) => chars[m]);
        let subject = "Withdraw Approved";
        await PassMailSend(withdrawUserData.email, subject, bodyData);

        return { status: true, message: "Withdraw Accepted" };
      } else {
        return { status: false, message: "Transaction Failed" };
      }
    } else if (data.type == "reject") {
      // console.log(">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>")
      const totalAmnt = addExact(data.amount, data.fees);
      // console.log(totalAmnt, "totalAmnt")
      await rejectUserRequest(data, totalAmnt, req, adminId);
      return { status: true, message: "Admin Rejected the User Request" };
    }
  } catch (error) {
    // console.log("???????????????????????????????????????????????????????")
    console.error("coin Withdraw Error:", error.message);
    return { status: false, message: "Internal Withdraw Error" };
  }
};

const coinTransfer = async (address, key, toAddress, amount) => {
  try {
    const gasPriceWei = await web3.eth.getGasPrice();
    const tx = {
      from: address,
      to: toAddress,
      gasPrice: gasPriceWei,
      gas: 21000,
      value: amount,
    };

    const transaction = await web3.eth.accounts.signTransaction(tx, key);

    const signed = await web3.eth.sendSignedTransaction(
      transaction.rawTransaction
    );

    return signed;
  } catch (error) {
    console.error("coin Transfer Error:", error.message);
    return false;
  }
};

const tokenTransfer = async (address, key, data) => {
  try {
    const gasPriceWei = await web3.eth.getGasPrice();
    const tx = {
      from: address,
      to: jsonrpc.ethconfig.Usdt_token,
      gasPrice: gasPriceWei,
      gas: 300000,
      data: data,
    };
    const transaction = await web3.eth.accounts.signTransaction(tx, key);
    const signed = await web3.eth.sendSignedTransaction(
      transaction.rawTransaction
    );
    return signed;
  } catch (error) {
    console.error("coin Transfer Error:", error);
    return false;
  }
};

// Admin Move
const formatWithoutRounding = (value, decimals) => {
  const factor = Math.pow(10, decimals);
  return Math.floor(value * factor) / factor;
};

exports.Eth_adminMove = async (ip, adminId, symbol, req) => {
  // console.log("adminId", adminId);

  try {
    const SuperAdminData = await adminUser.findOne({ _id: adminId });
    //console.log("SuperAdminData", adminId);

    const adminData = await AdminSettings.findOne(
      { userId: adminId },
      { evm_address: 1, evm_key: 1 }
    );

    if (!adminData || !adminData.evm_address || !adminData.evm_key) {
      return [
        { status: false, message: "Admin wallet not configured" }
      ];
    }

    const adminKey = await decryptionKey(adminData.evm_key);
    const adminAddress = adminData.evm_address;
    // console.log("adminAddress", adminAddress);

    const totalData = await Transaction.find(
      { moveCur: symbol, adminMoveStatus: 0 },
      { toaddress: 1 }
    );
    // console.log("totalData", totalData);

    let users = await getUnique(totalData, "toaddress");
    //.log("users>>>", users);

    // const users = await CoinAddress.find(
    //   { currencyname: "ETH" },
    //   { address: 1, encData: 1 }
    // );

    const { minBal, minTokenLimit } = jsonrpc.ethconfig;
    // console.log("minBal>>>", minBal, minTokenLimit);

    const encryptionPassword = jsonrpc.ethconfig.UserKey;

    const results = [];
    const toMove = [];
    const lowBalUsers = [];

    for (let i = 0; i < users.length; i++) {
      const userAddress = web3.utils.toChecksumAddress(users[i].toaddress);

      const u = await CoinAddress.findOne(
        { currencyname: "ETH", address: userAddress },
        { encData: 1 }
      );
      // console.log("u>>>", u);

      const decrypted = web3.eth.accounts.decrypt(
        u.encData,
        encryptionPassword
      );

      const userPK = decrypted.privateKey;

      if (symbol === "ETH") {
        const balWei = await web3.eth.getBalance(userAddress);
        //console.log("balWei>>>", balWei);

        const balEth = parseFloat(web3.utils.fromWei(balWei, "ether"));
        //console.log("balEth>>>", balEth);

        if (balEth >= minBal) {
          // console.log("work");
          toMove.push({ userAddress, userPK, balanceWei: balWei });
        } else {
          lowBalUsers.push(userAddress);
        }
      } else if (symbol === "USDT") {
        const usdtC = new web3.eth.Contract(
          usdt_abi,
          jsonrpc.ethconfig.Usdt_token
        );

        const tokenWei = await usdtC.methods.balanceOf(userAddress).call();
        const tokenAmt = parseFloat(web3.utils.fromWei(tokenWei, "ether"));
        const adminBalance = await web3.eth.getBalance(adminAddress);
        const EthBalanceAdmin = web3.utils.fromWei(adminBalance, "ether");
        const ethBal = parseFloat(
          web3.utils.fromWei(await web3.eth.getBalance(userAddress), "ether")
        );

        if (tokenAmt >= minTokenLimit) {
          if (ethBal < minBal) {
            if (parseFloat(EthBalanceAdmin) >= parseFloat(minBal)) {
              const minBalWei = web3.utils.toWei(minBal.toString(), "ether");
              // const totalAmountWei = minBalWei ;

              const sendEth = await coinTransfer(
                adminAddress,
                adminKey,
                userAddress,
                minBalWei
              );
              results.push({
                status: sendEth.transactionHash ? true : false,
                user: userAddress,
                moved: minBal,
                txHash: sendEth.transactionHash || null,
                note: "Admin sent ETH to cover gas for USDT transfer",
              });
              toMove.push({ userAddress, userPK, tokenWei });
            } else {
              results.push({
                status: false,
                message: "Insufficient Admin Balance",
              });
            }
          } else {
            toMove.push({ userAddress, userPK, tokenWei });
          }
        } else {
          lowBalUsers.push(userAddress);
        }
      }
    }

    for (let job of toMove) {
      // console.log("nextpoint--");

      let signedTx, movedAmt;

      if (symbol === "ETH") {
        const gasPrice = BigInt(await web3.eth.getGasPrice());
        const estGas = BigInt(
          await web3.eth.estimateGas({
            from: job.userAddress,
            to: adminAddress,
            value: job.balanceWei,
          })
        );
        const maxTransfer = BigInt(job.balanceWei) - gasPrice * estGas;

        signedTx = await coinTransfer(
          job.userAddress,
          job.userPK,
          adminAddress,
          maxTransfer.toString()
        );

        movedAmt = parseFloat(
          web3.utils.fromWei(maxTransfer.toString(), "ether")
        );
      } else if (symbol === "USDT") {
        // console.log("work");
        // return;

        const transferData = new web3.eth.Contract(
          usdt_abi,
          jsonrpc.ethconfig.Usdt_token
        ).methods
          .transfer(adminAddress, job.tokenWei)
          .encodeABI();

        signedTx = await tokenTransfer(
          job.userAddress,
          job.userPK,
          transferData
        );
        movedAmt = parseFloat(web3.utils.fromWei(job.tokenWei, "ether"));
      }

      if (signedTx.transactionHash) {
        const adminMoveSaveData = await adminHistory(
          job.userAddress,
          adminAddress,
          movedAmt,
          symbol,
          signedTx.transactionHash
        );
        // console.log("aadminMoveSaveData", adminMoveSaveData);

        const adminMovedData = await adminMovedStatus(
          job.userAddress.toLowerCase(),
          symbol
        );
        // console.log("adminMovedData", adminMovedData);

        results.push({
          status: true,
          user: job.userAddress,
          moved: movedAmt,
          txHash: signedTx.transactionHash,
        });
        // console.log("results", results);

        const EthAdminMoveActivity = await subAdminMethods.adminActivity(
          req,
          ip,
          "AdminMove",
          SuperAdminData?.email,
          SuperAdminData.admin_type,
          symbol,
          `${symbol} moved to Admin Wallet`
        );
      } else {
        results.push({
          status: false,
          user: job.userAddress,
          error: "Failed to broadcast transaction",
        });
      }
    }
    // console.log(toMove.length, lowBalUsers.length, users.length);
    // If no transfers happened
    if (toMove.length === 0) {
      if (
        lowBalUsers.length === users.length &&
        lowBalUsers.length > 0 &&
        users.length > 0
      ) {
        results.push({
          status: false,
          message: `You don’t have sufficient balance to move. A minimum of ${symbol == "ETH" ? minBal : minTokenLimit} ${symbol} is required.`,
        });
      } else {
        results.push({
          status: false,
          message: `No new ${symbol} deposits found`,
        });
      }
    }

    return results;
  } catch (error) {
    console.error("Admin Move Error:", error.message);
    return { status: false, message: "Internal Admin Move Error" };
  }
};
