const mongoose = require("mongoose");
const config = require("../Config/config");
const solanaWeb3 = require("@solana/web3.js");
const {
  Keypair,
  Connection,
  Transaction,
  PublicKey,
  sendAndConfirmTransaction,
} = solanaWeb3;
const CryptoJS = require("crypto-js");
const CoinAddress = require("../Modules/userModule/CoinAddress");
const ObjectId = mongoose.Types.ObjectId;
const fs = require("fs");
const path = require("path");
const primaryConfig = config.primarySmtp;
const nodemailer = require("nodemailer");
const hbs = require("nodemailer-express-handlebars");
const UserKey = "RempicExchangeWalletJHGJI^";
const axios = require("axios");
const depositTransaction = require("../Modules/userModule/Transaction");
const AdminSettings = require("../Modules/adminModule/AdminSettings");
const {
  decryptionKey,
  userHistory,
  rejectUserRequest,
  userDepositUpdate,
  currencyData,
  adminHistory,
} = require("../Controllers/adminControllers/adminController");
const rpcUrl = require("../Config/rpcUrl");
const connection = new Connection(rpcUrl.solconfig.APIUrl, "confirmed");
const Coindata = require("../Modules/userModule/pairData");
const subAdminMethods = require("../Controllers/adminControllers/SubAdminController");
const UserDb = require("../Modules/userModule/userModule");

const {
  adminMovedStatus,
} = require("../Controllers/userControllers/userController");
// const { log } = require("console");
const adminUser = require("../Modules/adminModule/AdminModule");

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

const formatWithoutRounding = (value, decimals) => {
  const factor = Math.pow(10, decimals);
  return Math.floor(value * factor) / factor;
};

function getUnique(arr, index) {
  const unique = arr
    .map((e) => e[index])
    .map((e, i, final) => final.indexOf(e) === i && i)
    .filter((e) => arr[e])
    .map((e) => arr[e]);
  return unique;
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

exports.SolanaAddress = async (userid) => {
  // const userid = res.locals.user_id
  let existingAddress = await CoinAddress.findOne({
    user_id: new ObjectId(userid),
    currencyname: "SOL",
  });
  if (existingAddress) {
    console.log("SOL address already exists for this user.");
    return existingAddress;
  }
  const account = solanaWeb3.Keypair.generate();
  const privateKeyUint8Array = new Uint8Array(account.secretKey, "base64");
  const keyPairs = solanaWeb3.Keypair.fromSecretKey(privateKeyUint8Array);
  const encryptionPassword = UserKey;
  const publicKey = keyPairs.publicKey;
  const walletPrivate = Buffer.from(privateKeyUint8Array).toString("hex");
  const walletAddress = publicKey.toString();
  const keystore = CryptoJS.AES.encrypt(
    walletPrivate,
    encryptionPassword
  ).toString();
  const baseDir = path.join(__dirname, "../Keystore");
  // console.log("Address:", walletAddress);
  // console.log("Private Key:", walletPrivate);
  try {
    if (!fs.existsSync(baseDir)) {
      fs.mkdirSync(baseDir, { recursive: true });
    }

    const filePath = path.join(baseDir, walletAddress.toLowerCase() + ".json");
    await fs.promises.writeFile(filePath, JSON.stringify(keystore), "utf8");
    // console.log("Wallet Created Successfully!");

    const newAddress = new CoinAddress({
      user_id: userid,
      address: walletAddress,
      currencyname: "SOL",
      encData: JSON.stringify(keystore),
    });

    await newAddress.save();

    return newAddress;
  } catch (err) {
    console.log("SOL CreateAddress : err : ", err);
  }
};

exports.SolanaDeposit = async (userId, symbol) => {
  try {
    const userData = await UserDb.findById({ _id: userId });
    const address_det = await CoinAddress.findOne({
      user_id: userId,
      currencyname: "SOL",
    });

    if (!address_det) {
      console.log("No SOL address found for user.");
      return { success: false, message: "No SOL address found", count: 0 };
    }

    const account = address_det.address;
    const solBlockNumber = address_det.solBlock?.sol || 0;
    const startSlot = solBlockNumber > 10000 ? solBlockNumber - 10000 : 0;

    // fetch signatures
    const response = await axios.post(rpcUrl.solconfig.APIUrl, {
      jsonrpc: "2.0",
      id: 1,
      method: "getSignaturesForAddress",
      params: [account, { limit: 1000 }],
    });

    const allTxs = response.data.result || [];
    const transactions = allTxs.filter((tx) => tx.slot >= solBlockNumber);

    if (transactions.length === 0) {
      return { success: false, message: "No new SOL deposits found", count: 0 };
    }

    let maxProcessedSlot = solBlockNumber;
    let newDepositCount = 0;

    for (const tx of transactions) {
      const txid = tx.signature;
      const block_number = tx.slot;
      maxProcessedSlot = Math.max(maxProcessedSlot, block_number);

      // get transaction details
      const txnDetailsResponse = await axios.post(rpcUrl.solconfig.APIUrl, {
        jsonrpc: "2.0",
        id: 1,
        method: "getTransaction",
        params: [
          txid,
          {
            encoding: "jsonParsed",
            commitment: "confirmed",
            maxSupportedTransactionVersion: 0,
          },
        ],
      });

      const txnDetails = txnDetailsResponse.data.result;
      if (!txnDetails || !txnDetails.meta) continue;

      const gasfee = txnDetails.meta.fee / 1e9;
      const instructions = txnDetails.transaction.message.instructions;

      // skip if already processed
      const existingTxn = await depositTransaction.findOne({
        txnId: txid,
        type: "Deposit",
      });
      if (existingTxn) continue;

      const symbolName = symbol + "USDT";
      const coinData = await Coindata.findOne({ symbol: symbolName });
      const currentPrice = coinData?.current_price || 0;

      for (const instruction of instructions) {
        if (instruction.program === "system") {
          const parsedData = instruction.parsed;
          if (!parsedData || !parsedData.info) continue;

          const toAddress = parsedData.info.destination;
          const fromAddress = parsedData.info.source;
          const lamports = parsedData.info.lamports;
          const amount = lamports / 1e9;
          const createdDate = new Date(
            (txnDetails.blockTime || Date.now()) * 1000
          );

          if (toAddress.toLowerCase() !== account.toLowerCase()) continue;

          const usdAmount = parseFloat(currentPrice) * parseFloat(amount);

          const depositData = {
            userId,
            toaddress: toAddress,
            amount,
            fromAddress,
            type: "Deposit",
            txnId: txid,
            fees: gasfee,
            status: 1,
            moveCur: symbol,
            currentDeposit_livePrice: currentPrice,
            usdAmount,
            createdDate,
          };

          const newTxn = new depositTransaction(depositData);
          const saved = await newTxn.save();

          if (saved?.status) {
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
            PassMailSend(userData.email, subject, emailBody);
          }
        }
      }
    }

    // update last processed slot
    if (maxProcessedSlot > solBlockNumber) {
      await CoinAddress.updateOne(
        { user_id: userId, currencyname: "SOL" },
        { $set: { "solBlock.sol": maxProcessedSlot } }
      );
    }

    if (newDepositCount > 0) {
      return {
        success: true,
        message: `${symbol} recent deposit updated successfully`,
        count: newDepositCount,
      };
    } else {
      return { success: false, message: "No new SOL deposits found", count: 0 };
    }
  } catch (error) {
    console.error("SolanaDeposit Error:", error);
    return { success: false, message: "Internal Error", count: 0 };
  }
};

// exports.SolanaDeposit = async (userId, symbol) => {
//     try {

//         const address_det = await CoinAddress.findOne({ user_id: userId, currencyname: "SOL" });

//         if (!address_det) {
//             console.log("No SOL address found for user.");
//             return false;
//         }
//         const account = address_det.address;
//         const solBlockNumber = address_det.solBlock?.sol || 0;
//         const startSlot = solBlockNumber > 10000 ? solBlockNumber - 10000 : 0;

//         const response = await axios.post(rpcUrl.solconfig.APIUrl, {
//             jsonrpc: "2.0",
//             id: 1,
//             method: "getSignaturesForAddress",
//             params: [account, { limit: 1000 }],
//         });

//         const allTxs = response.data.result || [];
//         const transactions = allTxs.filter((tx) => tx.slot >= solBlockNumber);

//         if (transactions.length === 0) {
//             console.log("No new SOL deposits found.");
//             return false;
//         }

//         let maxProcessedSlot = solBlockNumber;

//         for (let i = 0; i < transactions.length; i++) {
//             const tx = transactions[i]
//             const txid = tx.signature;
//             const block_number = tx.slot;
//             maxProcessedSlot = Math.max(maxProcessedSlot, block_number);

//             const txnDetailsResponse = await axios.post(rpcUrl.solconfig.APIUrl, {
//                 jsonrpc: "2.0",
//                 id: 1,
//                 method: "getTransaction",
//                 params: [
//                     txid,
//                     {
//                         encoding: "jsonParsed",
//                         commitment: "confirmed",
//                         maxSupportedTransactionVersion: 0,
//                     },
//                 ],
//             });

//             const txnDetails = txnDetailsResponse.data.result;
//             if (!txnDetails || !txnDetails.meta) continue;

//             const gasfee = txnDetails.meta.fee / 1e9;
//             const instructions = txnDetails.transaction.message.instructions;
//             const existingTxn = await depositTransaction.findOne({ txnId: txid, type: "Deposit" });
//             if (existingTxn) continue;
//             const symbolName = symbol + "USDT";
//             const coinData = await Coindata.findOne({ symbol: symbolName });
//             const currentPrice = coinData?.current_price || 0;

//             for (const instruction of instructions) {
//                 if (instruction.program === "system") {
//                     const parsedData = instruction.parsed;
//                     if (!parsedData || !parsedData.info) continue;

//                     const toAddress = parsedData.info.destination;
//                     const fromAddress = parsedData.info.source;
//                     const lamports = parsedData.info.lamports;
//                     const amount = lamports / 1e9;
//                     const createdDate = new Date((txnDetails.blockTime || Date.now()) * 1000);

//                     if (toAddress.toLowerCase() !== account.toLowerCase()) continue;

//                     const usdAmount = parseFloat(currentPrice) * parseFloat(amount);

//                     const depositData = {
//                         userId: userId,
//                         toaddress: toAddress,
//                         amount: amount,
//                         fromAddress: fromAddress,
//                         type: "Deposit",
//                         txnId: txid,
//                         fees: gasfee,
//                         status: 1,
//                         moveCur: symbol,
//                         currentDeposit_livePrice: currentPrice,
//                         usdAmount: usdAmount,
//                         createdDate: createdDate,
//                     };

//                     const newTxn = new depositTransaction(depositData);
//                     const saved = await newTxn.save();
//                     if (saved?.status) {
//                         await userDepositUpdate(userId, amount, symbol);
//                     }

//                 }
//             }
//         }

//         console.log(maxProcessedSlot,solBlockNumber)
//         await CoinAddress.updateOne(
//             { user_id: userId, currencyname: "SOL" },
//             { $set: { "solBlock.sol": maxProcessedSlot } }
//         );

//         return true;
//     } catch (error) {
//         console.error("SolanaDeposit Error:", error);
//         return false;
//     }
// };

exports.SolanaWithdraw = async (userId, data, req) => {
  try {
    const adminId = userId;
    // console.log("adminId", adminId);
    const adminData = await adminUser.findOne({ _id: adminId });
    // console.log("adminData>>>", adminData);
    let adminAddress;

    if (data.type == "approve") {
      if (adminData.admin_type == "SuperAdmin") {
        adminAddress = await AdminSettings.findOne(
          { userId: userId },
          { sol_address: 1, sol_key: 1 }
        );
        // console.log("adminAddressAdmin", adminAddress);
        // console.log("adminAddressAdmin-_key", adminAddress?.sol_key);

      }
      else {
        // console.log("work");

        adminAddress = await AdminSettings.findOne({});
        // console.log("adminAddress>>>>", adminAddress);

        // console.log("adminAddresssol_key", adminAddress?.sol_key);
      }


      let adminKey = await decryptionKey(adminAddress?.sol_key);
      // console.log("adminKey----", adminKey);

      const balance = await connection.getBalance(
        new solanaWeb3.PublicKey(adminAddress?.sol_address)
      );
      //console.log("balance", balance);

      const solBalance = balance / solanaWeb3.LAMPORTS_PER_SOL;
      // console.log('solBalance', solBalance);

      if (parseFloat(solBalance) > parseFloat(data.amount)) {
        const signed = await coinTransfer(
          adminKey,
          data.toaddress,
          data.amount
        );
        if (signed) {
          const SolSaveData = await userHistory(
            data.id,
            adminAddress.sol_address,
            signed,
            2
          );

          const SolanaWithdrawUser = await UserDb.findById({
            _id: SolSaveData.userId,
          });
          //console.log("SolanaWithdrawUser", SolanaWithdrawUser);
          if (adminData.admin_type == "SuperAdmin") {
            const SoladminActivity = await subAdminMethods.adminActivity(
              req,
              data.ip,
              "withdrawRequest",
              adminData.email,
              adminData.admin_type,
              SolanaWithdrawUser.email,
              `${SolSaveData.moveCur} Withdrawal Request Approved Successfully!`
            );
          } else {
            const SoladminActivity = await subAdminMethods.adminActivity(
              req,
              data.ip,
              "withdrawRequest",
              adminData.email,
              adminData.adminName,
              SolanaWithdrawUser.email,
              `${SolSaveData.moveCur} Withdrawal Request Approved Successfully!`
            );
          }

          const datas = fs.readFileSync(approveEmail, "utf8");
          let bodyData = datas.toString();
          const getSitesetting = await siteSetting.findOne({});
          const emailCotent = `Your ${data.amount} ${SolSaveData.moveCur} withdraw request Approved Successfully!`;
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
          PassMailSend(SolanaWithdrawUser.email, subject, bodyData);
          return { status: true, message: "Withdraw Accepted" };
        } else {
          return { status: false, message: "Transaction Failed" };
        }
      } else {
        return { status: false, message: "Insufficient Admin Balance" };
      }
    } else if (data.type == "reject") {
      // console.log(data.amount,data.fees)
      const totalAmnt = addExact(data.amount, data.fees);
      // console.log(totalAmnt,"totalAmt")
      await rejectUserRequest(data, totalAmnt, req, adminId);
      return { status: true, message: "Admin Rejected the User Request" };
    }
  } catch (error) {
    console.error("Solana Withdraw Error:", error);
    return false;
  }
};

const coinTransfer = async (key, toAddress, amount) => {
  try {
    const privateKeyInArr = Array.from(Buffer.from(key, "hex"));
    const keyPair = Keypair.fromSecretKey(Uint8Array.from(privateKeyInArr));
    const recipientPublicKey = toAddress;

    const lamports = BigInt(Math.floor(parseFloat(amount) * 1e9));
    // console.log(solanaWeb3.LAMPORTS_PER_SOL, "solanaWeb3.LAMPORTS_PER_SOL");

    const transaction = new solanaWeb3.Transaction().add(
      solanaWeb3.SystemProgram.transfer({
        fromPubkey: keyPair.publicKey,
        toPubkey: recipientPublicKey,
        lamports: lamports,
      })
    );

    const signature = await solanaWeb3.sendAndConfirmTransaction(
      connection,
      transaction,
      [keyPair]
    );
    return signature;
  } catch (error) {
    console.error("coin Transfer Error:", error);
    return false;
  }
};

// Admin Move

// exports.Solana_adminMove = async (adminId, symbol) => {
//     try {
//         const adminData = await AdminSettings.findOne({ userId: adminId }, { sol_address: 1 })
//         const adminAddress = adminData.sol_address
//         const userData = await CoinAddress.find({ currencyname: symbol }, { address: 1, encData: 1, currencyname: 1 })
//         let results = [];
//         for (let users of userData) {
//             const encryptedData = JSON.parse(users.encData);
//             const decryptedBytes = CryptoJS.AES.decrypt(encryptedData, UserKey);
//             const userPrivateKey = decryptedBytes.toString(CryptoJS.enc.Utf8);
//             const userAddress = users.address

//             const balance = await connection.getBalance(new solanaWeb3.PublicKey(userAddress));
//             const solBalance = balance / solanaWeb3.LAMPORTS_PER_SOL;
//             if (parseFloat(solBalance) > parseFloat(rpcUrl.solconfig.minBal)) {
//                 const totalAmnt = Number(solBalance) - Number(rpcUrl.solconfig.minBal)

//                 const signed = await coinTransfer(userPrivateKey, adminAddress, formatWithoutRounding(totalAmnt, 6))
//                 if (signed) {
//                     await adminHistory(userAddress, adminAddress, totalAmnt, symbol, signed)
//                     await adminMovedStatus(userAddress, symbol)
//                     results.push({ status: true, message: "Admin Transfer Completed" });
//                 }
//             } else {
//                 console.log("No Solana Coin Available");
//                 results.push({ status: false, message: "No Solana Coin Available" });
//             }
//         }
//         return results.length ? results : [{ status: false, message: "No Users Processed" }];
//     } catch (error) {
//         console.error('coin Admin Move Error:', error.message);
//         return [{ status: false, message: "Internal Admin Move Error" }];
//     }
// }

const estimateTransactionFee = async (fromKeypair, toPublicKey, balance) => {
  try {
    const { blockhash } = await connection.getLatestBlockhash();

    const transaction = new solanaWeb3.Transaction({
      recentBlockhash: blockhash,
      feePayer: fromKeypair,
    }).add(
      solanaWeb3.SystemProgram.transfer({
        fromPubkey: fromKeypair,
        toPubkey: toPublicKey,
        lamports: balance,
      })
    );

    const fee = await connection.getFeeForMessage(transaction.compileMessage());
    return fee.value;
  } catch (error) {
    console.log("error in estimate sol", error);
  }
};

exports.Solana_adminMove = async (ip, adminId, symbol, req) => {
  try {
    const SuperAdminData = await adminUser.findOne({ _id: adminId });
    // console.log("SuperAdminData>>>", SuperAdminData);

    const adminData = await AdminSettings.findOne(
      { userId: adminId },
      { sol_address: 1 }
    );
    // console.log("adminData", adminData);
    const adminAddress = adminData.sol_address;
    // console.log("adminAddress", adminAddress);

    // const userData = await CoinAddress.find({ currencyname: symbol }, { address: 1, encData: 1, currencyname: 1 });
    const totalData = await depositTransaction.find(
      { moveCur: symbol, adminMoveStatus: 0 },
      { toaddress: 1 }
    );
    // console.log("totalData", totalData);

    let userData = await getUnique(totalData, "toaddress");
    const minBal = parseFloat(rpcUrl.solconfig.minBal);
    /// console.log("minBal", tominBaltalData)

    // console.log("minBal", minBal);

    const feeBuffer = rpcUrl.solconfig.FEE_BUFFER_LAMPORTS;
    // console.log("feeBuffer", feeBuffer);


    let results = [];

    for (let user of userData) {
      // console.log("come loop---")
      const userAddress = user.toaddress;
      try {
        const users = await CoinAddress.findOne(
          { address: userAddress, currencyname: symbol },
          { encData: 1 }
        );


        const encryptedData = JSON.parse(users.encData);
        // console.log("encryptedData", encryptedData);

        const decryptedBytes = CryptoJS.AES.decrypt(encryptedData, UserKey);
        const userPrivateKey = decryptedBytes.toString(CryptoJS.enc.Utf8);

        let balance = await connection.getBalance(
          new solanaWeb3.PublicKey(userAddress)
        );

        let solBalance = Number(balance) / Number(solanaWeb3.LAMPORTS_PER_SOL);
        // console.log(
        //   solBalance,
        //   "solBalance>>>>",
        //   userAddress,
        //   minBal,
        //   solBalance >= minBal
        // );
        // console.log("solBalance", solBalance);

        if (solBalance >= minBal) {
          const feeInLamports = await estimateTransactionFee(
            new solanaWeb3.PublicKey(userAddress),
            new solanaWeb3.PublicKey(adminAddress),
            balance
          );
          balance = balance - feeInLamports;
          solBalance = Number(balance) / Number(solanaWeb3.LAMPORTS_PER_SOL);

          const transferableAmount = solBalance;

          const formattedAmount = formatWithoutRounding(transferableAmount, 6);

          const signed = await coinTransfer(
            userPrivateKey,
            adminAddress,
            formattedAmount
          );
          if (signed) {
            const soladminHistory = await adminHistory(
              userAddress,
              adminAddress,
              formattedAmount,
              symbol,
              signed
            );
            // console.log("soladminHistory", soladminHistory);

            const adminMovestatus = await adminMovedStatus(userAddress, symbol);
            // console.log("adminMovestatus", adminMovestatus);
            results.push({
              user: userAddress,
              status: true,
              message: `Transferred ${formattedAmount} SOL to Admin`,
            });
            const SolAdminMoveActivity = await subAdminMethods.adminActivity(
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
              user: userAddress,
              status: false,
              message: "Transaction failed during signing",
            });
          }
        } else {
          results.push({
            user: userAddress,
            status: false,
            message: `You don’t have sufficient balance to move. A minimum of ${minBal} SOL is required.`,
          });
        }
      } catch (innerErr) {
        console.error(
          `Error processing user ${userAddress}:`,
          innerErr.message
        );
        results.push({
          user: userAddress,
          status: false,
          message: "Error processing user balance or decryption",
        });
      }
    }

    const successfulTransfers = results.filter((r) => r.status === true);
    if (successfulTransfers.length === 0) {
      return [
        ...results,
        { status: false, message: "No new SOL deposits found" },
      ];
    }

    return results;
  } catch (error) {
    console.error("coin Admin Move Error:", error.message);
    return [{ status: false, message: "Internal Admin Move Error" }];
  }
};
