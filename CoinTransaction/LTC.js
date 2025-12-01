const config = require("../Config/config");
const litecoin = require('litecore-lib');
const bitcoin = require('bitcoinjs-lib');
const coininfo = require('coininfo');
const mongoose = require('mongoose')
const CoinAddress = require('../Modules/userModule/CoinAddress');
const ObjectId = mongoose.Types.ObjectId;
const jsonrpc = require('../Config/rpcUrl');
const fs = require('fs');
const path = require('path');
const nodemailer = require("nodemailer");
const hbs = require("nodemailer-express-handlebars");
const { userDepositUpdate, decryptionKey, rejectUserRequest, adminHistory } = require('../Controllers/adminControllers/adminController');
const Coindata = require('../Modules/userModule/pairData');
const depositTransaction = require('../Modules/userModule/Transaction');
const isTestnet = process.env.NETWORK === 'testnet';
// const network = isTestnet ? coininfo.litecoin.test.toBitcoinJS() : "";
const network = isTestnet ? litecoin.Networks.testnet : litecoin.Networks.livenet;
const mempoolJS = require("@mempool/mempool.js");
const AdminSettings = require('../Modules/adminModule/AdminSettings');
const { default: axios } = require('axios');
const rpcUrl = require('../Config/rpcUrl');
const { adminMovedStatus } = require('../Controllers/userControllers/userController');
const subAdminMethods = require("../Controllers/adminControllers/SubAdminController");
const UserDb = require("../Modules/userModule/userModule");
const adminUser = require("../Modules/adminModule/AdminModule");

const approveEmail = path.resolve(
  __dirname,
  "../Controllers/EmailTemplates/mailBody/approveWithdraw.txt"
);
const siteSetting = require("../Modules/adminModule/SiteSetting");

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

const PassMailSend = (to, sub, emailBody) => {
  try {
    let mailOptions = {
      from: `${config.mailFromAddress1}`,
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

  const [aInt, aDec = ''] = aStr.split('.');
  const [bInt, bDec = ''] = bStr.split('.');

  const decLength = Math.max(aDec.length, bDec.length);
  const aFull = BigInt(aInt + aDec.padEnd(decLength, '0'));
  const bFull = BigInt(bInt + bDec.padEnd(decLength, '0'));

  const sum = aFull + bFull;
  const sumStr = sum.toString().padStart(decLength + 1, '0');

  if (decLength === 0) {
    return sumStr;
  }

  const intPart = sumStr.slice(0, -decLength) || '0';
  const decPart = sumStr.slice(-decLength).replace(/0+$/, '');

  return decPart ? `${intPart}.${decPart}` : intPart;
}

function getUnique(arr, index) {

  const unique = arr
    .map(e => e[index])
    .map((e, i, final) => final.indexOf(e) === i && i)
    .filter(e => arr[e]).map(e => arr[e]);
  return unique;
}

// exports.LTCAddress = async (userid) => {
//     // const userid = res.locals.user_id
//         let existingAddress = await CoinAddress.findOne({ user_id: new ObjectId(userid), currencyname: "LTC" });
//         if (existingAddress) {
//             console.log('LTC address already exists for this user.');
//             return existingAddress;
//         }
//         const account = new litecoin.PrivateKey('mainnet');
//         const walletPrivate = account.toString();
//         const walletAddress = account.toAddress().toString();

//         const privateKey = litecoin.PrivateKey.fromWIF(walletPrivate);
//         const fromAddress = privateKey.toAddress(network).toString();
//         const baseDir = path.join(__dirname, '../Keystore/');
//         try {
//             const filePath = path.join(baseDir, walletAddress.toLowerCase() + ".json");
//             await fs.promises.writeFile(filePath, JSON.stringify(privateKey), 'utf8');
//             console.log("LTC Wallet Created Successfully!");

//             const newAddress = new CoinAddress({
//                 user_id: userid,
//                 address: fromAddress,
//                 currencyname: 'LTC',
//                 encData: privateKey,
//             });

//             await newAddress.save();
//             return newAddress;

//         }
//         catch (err) {
//             console.log("LTC CreateAddress : err : ", err)
//             return 
//         }
// }

exports.LTCAddress = async (userid) => {
  try {
    const existingAddress = await CoinAddress.findOne({ user_id: new ObjectId(userid), currencyname: "LTC" });
    if (existingAddress) {
      console.log('LTC address already exists for this user.');
      return existingAddress;
    }

    const privateKey = new litecoin.PrivateKey(network);
    const walletAddress = privateKey.toAddress().toString();
    const wif = privateKey.toWIF();

    const baseDir = path.join(__dirname, '../Keystore/');
    const filePath = path.join(baseDir, walletAddress.toLowerCase() + ".json");

    await fs.promises.writeFile(filePath, JSON.stringify({ wif }), 'utf8');

    // console.log("LTC Wallet Created Successfully!");

    const newAddress = new CoinAddress({
      user_id: userid,
      address: walletAddress,
      currencyname: 'LTC',
      encData: wif,
    });

    await newAddress.save();
    return newAddress;

  } catch (err) {
    console.error("LTC CreateAddress Error: ", err);
    throw err;
  }
};

// exports.LTCAddress = async (userid) => {
//     try {
//         const existingAddress = await CoinAddress.findOne({ user_id: new ObjectId(userid), currencyname: "LTC" });
//         if (existingAddress) {
//             console.log('LTC address already exists for this user.');
//             return existingAddress;
//         }

//         const keyPair = bitcoin.ECPair.makeRandom({ network: network });

//         // Generate a SegWit Bech32 address (P2WPKH)
//         const { address: walletAddress } = bitcoin.payments.p2wpkh({
//           pubkey: keyPair.publicKey,
//           network: network,
//         });

//         // Validate address (throws if invalid)
//         bitcoin.address.toOutputScript(walletAddress, network);
//         console.log('Generated address is valid:', walletAddress);

//         // Get WIF format private key
//         const wif = keyPair.toWIF();

//         // Save WIF to keystore JSON file
//         const baseDir = path.join(__dirname, '../Keystore/');
//         if (!fs.existsSync(baseDir)) {
//           fs.mkdirSync(baseDir, { recursive: true });
//         }
//         const filePath = path.join(baseDir, walletAddress.toLowerCase() + '.json');
//         await fs.promises.writeFile(filePath, JSON.stringify({ wif }), 'utf8');

//         console.log("LTC Wallet Created Successfully!");

//         // Save to DB
//         const newAddress = new CoinAddress({
//           user_id: userid,
//           address: walletAddress,
//           currencyname: 'LTC',
//           encData: wif,
//         });

//         await newAddress.save();

//         return newAddress;


//     } catch (err) {
//         console.error("LTC CreateAddress Error: ", err);
//         throw err;
//     }
// };


// exports.Deposit = async () => {
//     try {
//         console.log('Deposit function called for LTC');
//         const adminKey = "cUVjZxURBtLrGmoj1KXYJvy6tYaDeikRVbF3Ck564NywaeTPWiot";
//         const userAddress = "tltc1qjkna6kweklrmtcmz0hl27kjej98pswc6ft0uhd";
//         const amount = 0.0001; // Amount in LTC
//         await coinTransfer(adminKey, userAddress, amount);
//     } catch (error) {
//         console.log('Deposit Error:', error);
//         return false;
//     }
// }


exports.LtcDeposit = async (userid, symbol) => {
  try {
    // Get user's Litecoin address from database
    const userAddress = await CoinAddress.findOne({ user_id: userid, currencyname: "LTC" });
    if (!userAddress) {
      return { success: false, message: "No Litecoin address found for this user.", count: 0 };
    }

    const walletAddress = userAddress.address;
    const { bitcoin: { addresses } } = mempoolJS({
      hostname: "litecoinspace.org",
    });

    // fetch txs for this address
    const addressTxs = await addresses.getAddressTxs({ walletAddress });

    if (!addressTxs || addressTxs.length === 0) {
      return { success: false, message: "No transactions found for LTC address", count: 0 };
    }

    let newDepositCount = 0;

    for (let users of addressTxs) {
      const toAddress = users.vout[0]?.scriptpubkey_address;
      if (toAddress !== walletAddress) continue;

      // skip if already recorded
      const existingDeposit = await CoinDeposit.findOne({ txnId: users.txid, type: "Deposit" });
      if (existingDeposit) continue;

      const createdDate = new Date(Number(users.locktime) * 1000);
      const fromAddress = users.vin[0]?.prevout?.scriptpubkey_address || "";
      const amount = users.vout[0]?.value || 0;
      const transferAmnt = amount / 1e8;

      // save deposit
      const newDeposit = new CoinDeposit({
        userId: userid,
        toaddress: toAddress,
        amount: transferAmnt,
        fromAddress,
        fees: "",
        type: "Deposit",
        txnId: users.txid,
        status: 1,
        moveCur: "LTC",
        createdDate,
      });

      const saved = await newDeposit.save();
      if (saved?.status) {
        await userDepositUpdate(userid, transferAmnt, symbol);
        newDepositCount++;
      }
    }

    if (newDepositCount > 0) {
      return { success: true, message: `${symbol} recent deposit updated successfully`, count: newDepositCount };
    } else {
      return { success: false, message: "No new LTC deposits found", count: 0 };
    }
  } catch (error) {
    console.error("LtcDeposit Error:", error);
    return { success: false, message: "Internal Error", count: 0 };
  }
};


// exports.LtcDeposit = async (userid, symbol) => {
//     try {
//         // Get user's Litecoin Testnet address from database
//         const userAddress = await CoinAddress.findOne({ user_id: userid, currencyname: "LTC" });
//         if (!userAddress) {
//             return res.send({ status: false, error: "No Litecoin address found for this user." });
//         }

//         const walletAddress = userAddress.address;
//         const { bitcoin: { addresses } } = mempoolJS({
//             hostname: 'litecoinspace.org'
//         });

//         const addressTxs = await addresses.getAddressTxs({ walletAddress });
//         for (let users of addressTxs) {
//             // console.log(users,"----users");
//             const toAddress = users.vout[0].scriptpubkey_address
//             if (toAddress == walletAddress) {

//                 const existingDeposit = await CoinDeposit.findOne({ txnId: users.txid });
//                 if (!existingDeposit) {
//                     let createdDate = new Date(Number(users.locktime) * 1000);
//                     const fromAddress = users.vin[0].prevout.scriptpubkey_address
//                     const amount = users.vout[0].value
//                     const transferAmnt = amount / 1e8
//                     // if(transferAmnt > 0){
//                     const newDeposit = new CoinDeposit({
//                         userId: userid,
//                         toaddress: toAddress,
//                         amount: transferAmnt,
//                         fromAddress: fromAddress,
//                         fees: "",
//                         type: "Deposit",
//                         txnId: users.txid,
//                         status: 1,
//                         moveCur: "LTC",
//                         createdDate: createdDate
//                     });

//                     await newDeposit.save();
//                     await userDepositUpdate(userid, amount, symbol)
//                 // }else{
//                 //     return false;
//                 // }
//                 }
//             }
//         }

//         return true;
//     } catch (error) {
//         console.error('CoinDeposit Error:', error);
//         return false;
//     }
// };

exports.LtcWithdraw = async (userId, data) => {
  try {
    let adminAddress;
    const adminId = userId;
    const adminData = await adminUser.findOne({ _id: adminId });
    if (data.type == "approve") {
      if (adminData.admin_type == "SuperAdmin") {
        adminAddress = await AdminSettings.findOne({ userId: userId }, { ltc_address: 1, ltc_key: 1 })
      } else {
        adminAddress = await AdminSettings.findOne({});
      }
      let adminKey = await decryptionKey(adminAddress?.ltc_key);
      const balance = await axios.get(`https://api.blockcypher.com/v1/ltc/main/addrs/${adminAddress.ltc_address}`)
      const ltcBalance = balance.final_balance / 1e8
      if (parseFloat(ltcBalance) > parseFloat(data.amount)) {
        const signed = await coinTransfer(adminKey, data.toaddress, data.amount)
        if (signed) {
          const LTCSaveData = await userHistory(data.id, adminAddress.ltc_address, signed, 2)
          const withdrawLTCUser = await userDb.findById({
            _id: LTCSaveData.userId,
          });
          if (adminData.admin_type == "SuperAdmin") {
            const LTCAdminActivity = await subAdminMethods.adminActivity(
              req,
              data.ip,
              "withdrawRequest",
              adminData.email,
              adminData.admin_type,
              withdrawLTCUser.email,
              `${LTCSaveData.moveCur} withdraw Approve Successfully!`
            );
          } else {
            const LTCAdminActivity = await subAdminMethods.adminActivity(
              req,
              data.ip,
              "withdrawRequest",
              adminData.email,
              adminData.adminName,
              withdrawLTCUser.email,
              `${LTCSaveData.moveCur} withdraw Approve Successfully!`
            );
          }

          const datas = fs.readFileSync(approveEmail, "utf8");
          let bodyData = datas.toString();
          const getSitesetting = await siteSetting.findOne({});
          const emailCotent = `Your ${data.amount} ${LTCSaveData.moveCur} withdraw request Approved Successfully!`;
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
          PassMailSend(withdrawLTCUser.email, subject, bodyData);
          return { status: true, message: "Withdraw Acceptd" };
        } else {
          return { status: false, message: "Transaction Failed" };
        }
      } else {
        return { status: false, message: "Insufficient Admin Balance" };
      }
    } else if (data.type == "reject") {
      const totalAmnt = addExact(data.amount, data.fees)
      await rejectUserRequest(data, totalAmnt)
      return { status: true, message: "Admin Rejected the User Request" };
    }

  } catch (error) {
    console.error("Litecoin Withdraw Error:", error);
    return false;
  }
};

const coinTransfer = async (key, toAddress, amount) => {
  try {
    // const privateKey = litecoin.PrivateKey.fromWIF(key);
    // const fromAddress = privateKey.toAddress(network).toString();
    const keyPair = bitcoin.ECPair.fromWIF(
      key,
      network
    );

    const { address } = bitcoin.payments.p2wpkh({
      pubkey: keyPair.publicKey,
      network: network,
    });
    const fromAddress = address;

    // console.log(fromAddress, "fromAddress>>>>>")
    const res = await axios.get(`https://litecoinspace.org/api/address/${fromAddress}/utxo`);
    const utxosData = res.data;

    if (!utxosData.length) {
      console.log("No UTXOs found. Please send LTC to this address first.");
      return false;
    }

    // Convert to UTXO format required by litecore-lib
    const utxos = utxosData.map((utxo) => ({
      txId: utxo.txid,
      outputIndex: utxo.output_no,
      address: fromAddress,
      script: litecoin.Script.buildPublicKeyHashOut(fromAddress).toString(),
      satoshis: Math.floor(parseFloat(utxo.value) * 1e8), // convert LTC to satoshis
    }));

    const amountToSend = amount * 1e8;
    const fee = 10000;

    const transaction = new litecoin.Transaction()
      .from(utxos)
      .to(toAddress, amountToSend)
      .fee(fee)
      .change(fromAddress)
      .sign(privateKey);

    const rawTx = transaction.serialize();
    // console.log("Raw Transaction Hex:", rawTx);
    return rawTx;
  } catch (error) {
    console.error('coin Transfer Error:', error.message);
    return false;
  }
}

// const coinTransfer = async (key, toAddress, amount) => {
//     try {
//         const privateKey = "ce4e7eabe38c183cd3bc41f555e26321ea05368f7620078e1dd3fcb99df28b54";
//         console.log(network, "network");
//         // const fromAddress = privateKey.toAddress(network).toString();
//         // console.log(fromAddress, "fromAddress");

//         const res = await axios.get(`https://litecoinspace.org/testnet/api/address/tltc1ql2qvdctfwe6qr8lxlnk66gqtu4hplau85sx9u6/utxo`);
//         const utxosData = res.data;
//         console.log("UTXOs Data:", utxosData);

//         if (!utxosData.length) {
//             console.log("No UTXOs found.");
//             return false;
//         }

//         const utxos = utxosData.map((utxo) => ({
//             txId: utxo.txid,
//             outputIndex: utxo.vout,
//             address: "tltc1ql2qvdctfwe6qr8lxlnk66gqtu4hplau85sx9u6",
//             script: litecoin.Script.buildPublicKeyHashOut("tltc1ql2qvdctfwe6qr8lxlnk66gqtu4hplau85sx9u6").toString(), 
//             satoshis: utxo.value, 
//         }));
//         console.log("UTXOs:", utxos);


//         const amountToSend = amount * 1e8;
//         const fee = 10000;
//         const total = utxos.reduce((sum, u) => sum + u.satoshis, 0);
//         if (total < amountToSend + fee) {
//             console.error("Insufficient balance.");
//             return false;
//         }

//         const transaction = new litecoin.Transaction()
//             .from(utxos)
//             .to(toAddress, amountToSend)
//             .fee(fee)
//             .change("tltc1ql2qvdctfwe6qr8lxlnk66gqtu4hplau85sx9u6")
//             .sign(privateKey);

//         const rawTx = transaction.serialize();
//         console.log("Raw Transaction Hex:", rawTx);

//         // Broadcast it (optional)
//         // await axios.post(`https://litecoinspace.org/testnet/api/tx/send`, { rawtx: rawTx });

//         return rawTx;
//     } catch (error) {
//         console.error("Transfer error:", error.message);
//         return false;
//     }
// }

// Admin Move


// const coinTransfer = async (wif, toAddress, amount) => {
//   try {
//     const keyPair = bitcoin.ECPair.fromWIF(wif, network);

//     const { address: fromAddress } = bitcoin.payments.p2wpkh({
//       pubkey: keyPair.publicKey,
//       network,
//     });
//     console.log(await axios.get(`https://api.blockcypher.com/v1/ltc/test3/addrs/tltc1ql2qvdctfwe6qr8lxlnk66gqtu4hplau85sx9u6/balance`))

//     const res = await axios.get(`https://litecoinspace.org/api/address/${fromAddress}/utxo`);
//     console.log(res,"res>>>>>>>>>>>")
//     const utxos = res.data;

//     if (!utxos.length) {
//       console.log("No UTXOs found.");
//       return false;
//     }

//     const psbt = new bitcoin.Psbt({ network });

//     let inputAmount = 0;
//     const satoshisToSend = Math.floor(amount * 1e8);
//     const fee = 10000; 

//     for (const utxo of utxos) {
//       psbt.addInput({
//         hash: utxo.txid,
//         index: utxo.output_no,
//         witnessUtxo: {
//           script: bitcoin.payments.p2wpkh({ pubkey: keyPair.publicKey, network }).output,
//           value: Math.floor(parseFloat(utxo.value) * 1e8),
//         },
//       });
//       inputAmount += Math.floor(parseFloat(utxo.value) * 1e8);
//       if (inputAmount >= satoshisToSend + fee) break;
//     }

//     if (inputAmount < satoshisToSend + fee) {
//       console.log("Insufficient balance.");
//       return false;
//     }

//     psbt.addOutput({
//       address: toAddress,
//       value: satoshisToSend,
//     });

//     const change = inputAmount - satoshisToSend - fee;
//     if (change > 0) {
//       psbt.addOutput({
//         address: fromAddress,
//         value: change,
//       });
//     }

//     psbt.signAllInputs(keyPair);
//     psbt.finalizeAllInputs();

//     const rawTx = psbt.extractTransaction().toHex();
//     console.log("Raw Transaction:", rawTx);
//     return rawTx;

//   } catch (err) {
//     console.error("Transaction Error:", err.message);
//     return false;
//   }
// };


exports.Ltc_adminMove = async (ip, adminId, symbol, req) => {
  try {
    const SuperAdminData = await adminUser.findOne({ _id: adminId });
    const adminData = await AdminSettings.findOne({ userId: adminId }, { ltc_address: 1 })
    const adminAddress = adminData.ltc_address
    // const userData = await CoinAddress.find({ currencyname: symbol }, { address: 1, encData: 1, currencyname: 1 })
    const totalData = await depositTransaction.find({ moveCur: symbol, adminMoveStatus: 0 }, { toaddress: 1 })
    let userData = await getUnique(totalData, 'toaddress')
    let results = [];
    for (let user of userData) {
      const userAddress = user.toaddress;
      const users = await CoinAddress.findOne({ address: userAddress, currencyname: symbol }, { encData: 1 })
      const userPrivateKey = users.encData

      const balance = await axios.get(`https://api.blockcypher.com/v1/ltc/main/addrs/${userAddress}`)
      const ltcBalance = balance.final_balance / 1e8
      if (parseFloat(ltcBalance) > parseFloat(rpcUrl.ltcconfig.minBal)) {
        const totalAmnt = Number(ltcBalance) - Number(rpcUrl.ltcconfig.minBal)

        const signed = await coinTransfer(userPrivateKey, adminAddress, totalAmnt)
        if (signed) {
          await adminHistory(userAddress, adminAddress, totalAmnt, symbol, signed)
          await adminMovedStatus(userAddress, symbol)
          results.push({ status: true, message: "Admin Transfer Completed" });
          const LTCAdminMoveActivity = await subAdminMethods.adminActivity(
            req,
            ip,
            "AdminMove",
            SuperAdminData?.email,
            SuperAdminData.adminName,
            symbol,
            `${symbol} moved to Admin Wallet`
          );
        }
      } else {
        console.log("No Litecoin Coin Available");
        results.push({ status: false, message: `You don’t have sufficient balance to move. A minimum of ${rpcUrl.ltcconfig.minBal} LTC is required.` });
      }
    }
    return results.length ? results : [{ status: false, message: "No new LTC deposits found" }];
  } catch (error) {
    console.error('coin Admin Move Error:', error.message);
    return [{ status: false, message: "Internal Admin Move Error" }];
  }
}