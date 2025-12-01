const mongoose = require("mongoose");
const CoinAddress = require("../Modules/userModule/CoinAddress");
const jsonrpc = require("../Config/rpcUrl");
let fs = require("fs");
const path = require("path");
const nodemailer = require("nodemailer");
const hbs = require("nodemailer-express-handlebars");
const Transaction = require("../Modules/userModule/Transaction");
const axios = require("axios");
const bitcoin = require("bitcoinjs-lib");
const isTestnet = process.env.NETWORK === "testnet";
const btcnetwork = isTestnet
  ? bitcoin.networks.testnet
  : bitcoin.networks.bitcoin;
const wif = require("wif");
const Web3 = require("web3");
let nodeUrl = jsonrpc.ethconfig.host;
let provider = new Web3.providers.HttpProvider(nodeUrl);
const web3 = new Web3(provider);
const ObjectId = mongoose.Types.ObjectId;
const IV_LENGTH = 16;
const ENCRYPTION_KEY = "abcdef1234567890ABCDEF1234567890";
const crypto = require("crypto");
const {
  decryptionKey,
  userHistory,
  userDepositUpdate,
  rejectUserRequest,
  currencyData,
  adminHistory,
} = require("../Controllers/adminControllers/adminController");
const AdminSettings = require("../Modules/adminModule/AdminSettings");
const Coindata = require("../Modules/userModule/pairData");
const {
  adminMovedStatus,
} = require("../Controllers/userControllers/userController");
const config = require("../Config/config");
const adminUser = require("../Modules/adminModule/AdminModule");
const userDb = require("../Modules/userModule/userModule");
const subAdminMethods = require("../Controllers/adminControllers/SubAdminController");
const approveEmail = path.resolve(
  __dirname,
  "../Controllers/EmailTemplates/mailBody/approveWithdraw.txt"
);

const depositMail = path.resolve(
  __dirname,
  "../Controllers/EmailTemplates/mailBody/depositMail.txt"
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


// const encryptbtc = (privateKey) => {
//     try {
//         const iv = crypto.randomBytes(IV_LENGTH);
//         const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'utf8'), iv);
//         let encrypted = cipher.update(privateKey, 'utf8', 'hex');
//         encrypted += cipher.final('hex');
//         return JSON.stringify({ iv: iv.toString('hex'), encryptedData: encrypted });
//     } catch (err) {
//         console.error("Encryption Error: ", err);
//         return null;
//     }
// };
// const decryptbtc = (encryptedString) => {
//     try {
//         const { iv, encryptedData } = JSON.parse(encryptedString);
//         const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'utf8'), Buffer.from(iv, 'hex'));
//         let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
//         decrypted += decipher.final('utf8');
//         return decrypted;
//     } catch (err) {
//         console.error("Decryption Error: ", err);
//         return null;
//     }
// };

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

exports.BTCCreateAddress = async (userid) => {
  try {
    // const userid = res.locals.user_id;
    // console.log('userid', userid)
    let existingAddress = await CoinAddress.findOne({
      user_id: new ObjectId(userid),
      currencyname: "BTC",
    });
    // console.log('existingAddress', existingAddress)
    if (existingAddress) {
      console.log("BTC address already exists for this user.");
      return existingAddress;
    }
    const keyPairCreation = bitcoin.ECPair.makeRandom({ network: btcnetwork });
    // console.log('keyPairCreation----', keyPairCreation)
    if (!keyPairCreation.privateKey) {
      return { error: "Failed to generate private key" };
    }
    const privateKeyHex = keyPairCreation.privateKey.toString("hex");
    // console.log('privateKeyHex-', privateKeyHex);
    const keyPairForUser = bitcoin.ECPair.fromPrivateKey(
      Buffer.from(privateKeyHex, "hex")
    );
    const publicKey = keyPairForUser.publicKey.toString("hex");

    const { address } = bitcoin.payments.p2wpkh({
      pubkey: keyPairForUser.publicKey,
      network: btcnetwork,
    });
    if (!address) {
      return { error: "Failed to generate wallet address" };
    }

    // console.log('walletAddress', address);
    // console.log('publicKey-----', publicKey);

    // var keystore = encryptbtc(privateKeyHex);
    // console.log('keystore', keystore);

    const baseDir = path.join(__dirname, "../Keystore");

    if (!fs.existsSync(baseDir)) {
      fs.mkdirSync(baseDir, { recursive: true });
    }
    const filePath = path.join(baseDir, address.toLowerCase() + ".json");

    await fs.promises.writeFile(
      filePath,
      JSON.stringify(privateKeyHex),
      "utf8"
    );
    // console.log("Wallet Created Successfully!");

    const newAddress = new CoinAddress({
      user_id: userid,
      address: address,
      currencyname: "BTC",
      encData: privateKeyHex,
    });

    await newAddress.save();

    return newAddress;
    // }
  } catch (err) {
    console.error("BTC CreateAddress : err :", err);
    return false;
  }
};

// exports.BtcDeposit = async function (userId,symbol) {
//     try {

//             const address_det = await CoinAddress.findOne({ user_id: userId, currencyname: "BTC" });
//             console.log(address_det, "address_det>>>>>>>>>")
//             if (!address_det) {
//                 console.log('No BTC address found for user');
//                 return false;
//             }

//             bitcoin_rpc.call('listtransactions', ['*', 1000], async function (err, response) {
//                 if (err) {
//                     console.log('Error fetching transactions:', err);
//                     // return;
//                 }
//                 console.log(response,"responce>>>>>>>>>")
//                 const transactions = response.result;
//                 console.log(transactions)
//                 for (const tx of transactions) {
//                     try {
//                         const { confirmations, txid, amount, address, category } = tx;

//                         if (category === "receive" && address === address_det.address) {
//                             const existingDeposit = await Transaction.findOne({
//                                 userId: mongoose.Types.ObjectId(userId),
//                                 txnId: txid,
//                                 type: "Deposit"
//                             });

//                             if (!existingDeposit) {
//                                 if (confirmations >= 3) {

//                                     const Symbol = symbol + "USDT"
//                                     console.log('Symbol', Symbol);
//                                     let coinData = await Coindata.findOne({ symbol: Symbol });
//                                     console.log('coinData', coinData)
//                                     let currentPrice = coinData?.current_price || 0;
//                                     console.log(`Current Price of ${symbol}:`, currentPrice);

//                                     let usdAmount = parseFloat(currentPrice) * parseFloat(amount);
//                                     console.log(`USD Amount of Deposit:`, usdAmount);

//                                     const depositData = new Transaction({
//                                         userId: mongoose.Types.ObjectId(userId),
//                                         address: address,
//                                         amount: amount,
//                                         type: "Deposit",
//                                         txnId: txid,
//                                         currentDeposit_livePrice: currentPrice,
//                                         usdAmount:usdAmount,
//                                         status: 1,
//                                     });

//                                     await depositData.save();
//                                     await userDepositUpdate(userId, amount, symbol)
//                                     // console.log(`BTC deposit of ${amount} confirmed for user ${userId}`);
//                                 } else {
//                                     console.log(`BTC transaction ${txid} found but waiting for confirmations.`);
//                                 }
//                             } else {
//                                 console.log(`BTC transaction ${txid} already recorded.`);
//                             }
//                         }
//                     } catch (error) {
//                         console.log('Error processing transaction:', error);
//                     }
//                 }
//             });

//     } catch (e) {
//         console.log('CoinDeposit Error:', e);
//     }
// };

exports.BtcDeposit = async function (userId, symbol) {
  try {
    const userData = await userDb.findById({ _id: userId });
    const address_det = await CoinAddress.findOne({
      user_id: userId,
      currencyname: "BTC",
    });
    if (!address_det) {
      console.log("No BTC address found for user");
      return false;
    }

    const response = await axios.get(
      `${config.BTCURL}${address_det.address}/full`
    );
    const txs = response.data?.txs || [];
    const address = response.data?.address;

    let previousBlock = address_det.btcBlock?.btc || 0;
    let maxProcessedBlock = previousBlock;
    let depositMade = false;
    let newDepositCount = 0;

    for (const tx of txs) {
      const {
        block_height: blockHeight,
        confirmations,
        hash: txid,
        inputs,
        outputs,
      } = tx;

      // Skip if no block or old block
      if (!blockHeight || blockHeight <= previousBlock) continue;

      // Find if any output belongs to our address
      const toOurOutput = outputs.find((o) => o.addresses?.includes(address));
      if (!toOurOutput) continue;

      const fromAddresses = inputs.flatMap((i) => i.addresses || []);
      const fromAddress = fromAddresses[0] || "";

      const amount = toOurOutput.value / 1e8; // BTC in satoshis
      const category = "receive"; // since it’s to our address

      // Skip if not receive or wrong address
      if (category !== "receive" || address !== address_det.address) continue;

      // Check if already processed
      const existing = await Transaction.findOne({
        userId: new ObjectId(userId),
        txnId: txid,
        type: "Deposit",
      });
      if (existing) {
        console.log(`BTC transaction ${txid} already recorded.`);
        continue;
      }

      // Check confirmations
      if (confirmations <= 1) {
        console.log(
          `BTC transaction ${txid} found but waiting for confirmations.`
        );
        continue; // don’t rollback block, just skip
      }

      // Get price
      const Symbol = symbol + "USDT";
      const coinData = await Coindata.findOne({ symbol: Symbol });
      const currentPrice = coinData?.current_price || 0;
      const usdAmount = parseFloat(currentPrice) * parseFloat(amount);

      // Save deposit
      const depositData = new Transaction({
        userId: new ObjectId(userId),
        toaddress: address,
        fromAddress,
        amount,
        fees: "",
        type: "Deposit",
        txnId: txid,
        status: 1,
        moveCur: symbol,
        currentDeposit_livePrice: currentPrice,
        usdAmount,
      });

      const saved = await depositData.save();
      if (saved?.status) {
        depositMade = true;
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
        console.log(`BTC deposit of ${amount} confirmed for user ${userId}`);
      }

      maxProcessedBlock = Math.max(maxProcessedBlock, blockHeight);
    }

    // Update latest processed block if new confirmed txs found
    if (maxProcessedBlock > previousBlock) {
      await CoinAddress.updateOne(
        { user_id: userId, currencyname: "BTC" },
        { $set: { "btcBlock.btc": maxProcessedBlock } }
      );
    }

    if (newDepositCount > 0) {
      return {
        success: depositMade,
        message: `${symbol} recent deposit updated successfully`,
        count: newDepositCount,
      };
    } else {
      return {
        success: depositMade,
        message: "No new BTC deposits found",
        count: 0,
      };
    }
  } catch (e) {
    console.error("BTC Deposit Error:", e);
    return false;
  }
};

exports.BtcWithdraw = async (userId, data, req) => {
  try {
    const adminId = userId;
    const adminData = await adminUser.findOne({ _id: adminId });
    //console.log("adminData", adminData);
    let adminAddress;

    if (data.type == "approve") {
      if (adminData.admin_type == "SuperAdmin") {
        adminAddress = await AdminSettings.findOne(
          { userId: userId },
          { btc_address: 1, btc_publicKey: 1 }
        );
      } else {
        adminAddress = await AdminSettings.findOne({});
      }

      let adminPublicKey = await decryptionKey(adminAddress?.btc_publicKey);
      // console.log('adminPublicKey----', adminPublicKey.length)

      const decoded = wif.decode(adminPublicKey);
      // console.log('Decoded WIF:', decoded);
      const privateKeyBuffer = Buffer.from(decoded.privateKey);
      // console.log('privateKeyBuffer:', privateKeyBuffer.toString('hex'));
      const keyPair = bitcoin.ECPair.fromPrivateKey(privateKeyBuffer, {
        network: btcnetwork,
      });
      const keyPairs = bitcoin.ECPair.fromPrivateKey(
        Buffer.from(keyPair.privateKey, "hex")
      );

      const { address } = bitcoin.payments.p2wpkh({
        pubkey: keyPair.publicKey,
        network: btcnetwork,
      });
      // console.log('BTC Address:', address);
      const addr_balance = await axios.get(
        `${jsonrpc.btcconfig.APIUrl}addrs/${address}/balance?token=${config.BTC_TokenAPI}`
      );
      // console.log('addr_balance---', addr_balance.data)
      const adminBalance = addr_balance.data.balance;

      const BTC_balance = adminBalance / 1e8;
      // console.log(BTC_balance, data.amount)

      if (parseFloat(BTC_balance) >= parseFloat(data.amount)) {
        const transferData = await coinTransfer(
          address,
          data.amount,
          data.toaddress,
          keyPairs
        );

        if (transferData) {
          const BTCSaveData = await userHistory(data.id, adminAddress.btc_address, transferData, 2);
          const withdrawBTCUser = await userDb.findById({
            _id: BTCSaveData.userId,
          });
          if (adminData.admin_type == "SuperAdmin") {
            const BTCAdminActivity = await subAdminMethods.adminActivity(
              req,
              data.ip,
              "withdrawRequest",
              adminData.email,
              adminData.admin_type,
              withdrawBTCUser.email,
              `${BTCSaveData.moveCur} withdraw Approve Successfully!`
            );
          } else {
            const BTCAdminActivity = await subAdminMethods.adminActivity(
              req,
              data.ip,
              "withdrawRequest",
              adminData.email,
              adminData.adminName,
              withdrawBTCUser.email,
              `${BTCSaveData.moveCur} withdraw Approve Successfully!`
            );
          }


          const datas = fs.readFileSync(approveEmail, "utf8");
          let bodyData = datas.toString();
          const getSitesetting = await siteSetting.findOne({});
          const emailCotent = `Your ${data.amount} ${BTCSaveData.moveCur} withdraw request Approved Successfully!`;
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
          PassMailSend(withdrawBTCUser.email, subject, bodyData);
          return { status: true, message: "Withdraw Accepted" };
        } else {
          return { status: false, message: "Transaction Failed" };
        }
      } else {
        return { status: false, message: "Insufficient Admin Balance" };
      }
    } else if (data.type == "reject") {
      const totalAmnt = addExact(data.amount, data.fees);
      await rejectUserRequest(data, totalAmnt, req, adminId);
      return { status: true, message: "Admin Rejected the User Request" };
    }
  } catch (error) {
    console.error("coin Withdraw Error:", error);
    return { status: false, message: "Internal Withdraw Error" };
  }
};

// Admin Move

async function getUTXOs(address) {
  const url = `${jsonrpc.btcconfig.APIUrl}addrs/${address}?unspentOnly=true&token=${config.BTC_TokenAPI}`;
  const response = await axios.get(url);
  return response.data.txrefs || [];
}

// Select UTXOs to cover amount + fee
function selectUTXOs(utxos, amountSats, feeSats) {
  let total = 0;
  const selected = [];

  for (const utxo of utxos) {
    selected.push(utxo);
    total += utxo.value;
    if (total >= amountSats + feeSats) break;
  }

  if (total < amountSats + feeSats)
    throw new Error("Insufficient balance to cover amount + fee");

  return { selected, total };
}

// Build, sign and return raw tx hex
function buildTransaction(
  selectedUTXOs,
  toAddress,
  amountSats,
  changeAddress,
  feeSats,
  keyPair
) {
  const psbt = new bitcoin.Psbt({ network: btcnetwork });

  // Add inputs
  selectedUTXOs.forEach((utxo) => {
    psbt.addInput({
      hash: utxo.tx_hash,
      index: utxo.tx_output_n,
      nonWitnessUtxo: Buffer.from(utxo.rawTxHex, "hex"),
    });
  });
  // console.log(amountSats, "amountSats>>>>>>>>>>>>>>>")
  // Add output to recipient
  psbt.addOutput({ address: toAddress, value: amountSats });

  // Calculate change
  const inputTotal = selectedUTXOs.reduce((sum, utxo) => sum + utxo.value, 0);
  const change = inputTotal - amountSats - feeSats;
  // console.log(change, "change>>>>>>>>>>>>>>>")

  if (change > 0) {
    psbt.addOutput({ address: changeAddress, value: change });
  }

  // Sign all inputs
  selectedUTXOs.forEach((_, idx) => {
    psbt.signInput(idx, keyPair);
  });

  // Validate signatures
  psbt.validateSignaturesOfAllInputs();
  psbt.finalizeAllInputs();

  // Extract raw transaction hex
  return psbt.extractTransaction().toHex();
}

// Get raw transaction hex for each UTXO (required for signing)
async function fetchRawTxHex(utxo) {
  try {
    const txUrl = `${jsonrpc.btcconfig.APIUrl}txs/${utxo.tx_hash}?includeHex=true&token=${config.BTC_TokenAPI}`;
    const response = await axios.get(txUrl);
    // console.log(response)
    return response.data.hex;
  } catch (error) {
    console.log("BTC fetchRawTxHex", error);
  }
}

// Broadcast raw tx hex via BlockCypher
async function broadcastTx(rawTxHex) {
  const url = `${jsonrpc.btcconfig.APIUrl}txs/push?token=${config.BTC_TokenAPI}`;
  const response = await axios.post(url, { tx: rawTxHex });
  return response.data;
}

function estimateTxFee(numInputs, numOutputs, feeRate = 10) {
  const size = numInputs * 148 + numOutputs * 34 + 10;
  return size * feeRate; // satoshis
}

// Get dynamic fee rate
async function getRecommendedFeeRate() {
  const res = await axios.get("https://mempool.space/api/v1/fees/recommended");
  return res.data.fastestFee;
}

async function coinTransfer(fromAddress, amountBTC, toAddress, keyPair) {
  try {
    const amountSats = Math.round(amountBTC * 1e8);

    // Step 1: Fetch UTXOs
    let utxos = await getUTXOs(fromAddress);
    if (utxos.length === 0) throw new Error("No UTXOs found for address");

    // Step 2: Get fee rate
    const feeRate = await getRecommendedFeeRate(); // e.g., 20 sat/vB

    // Step 3: Estimate fee based on max needed inputs
    const numInputs = utxos.length;
    const numOutputs = 2; // recipient + change
    const estimatedFee = estimateTxFee(numInputs, numOutputs, feeRate);

    // Step 4: Select UTXOs that cover amount + estimated fee
    const { selected, total } = selectUTXOs(utxos, amountSats, estimatedFee);

    // Step 5: Fetch raw hex for selected UTXOs
    const selectedWithHex = await Promise.all(
      selected.map(async (utxo) => ({
        ...utxo,
        rawTxHex: await fetchRawTxHex(utxo),
      }))
    );

    // Step 6: Final fee estimation using selected inputs
    const actualFee = estimateTxFee(
      selectedWithHex.length,
      numOutputs,
      feeRate
    );

    // Step 7: Build, sign, and serialize the transaction
    const rawTxHex = buildTransaction(
      selectedWithHex,
      toAddress,
      amountSats,
      fromAddress,
      actualFee,
      keyPair
    );

    // Step 8: Broadcast transaction
    const result = await broadcastTx(rawTxHex);
    // console.log('Transaction broadcasted! TX Hash:', result.tx.hash);
    return result.tx.hash;
  } catch (error) {
    console.error("Transfer failed:", error.message);
    throw error;
  }
}

exports.Btc_adminMove = async (ip, adminId, symbol, req) => {
  try {
    const SuperAdminData = await adminUser.findOne({ _id: adminId });
    const adminData = await AdminSettings.findOne(
      { userId: adminId },
      { btc_address: 1 }
    );
    const adminAddress = adminData.btc_address;
    // const userData = await CoinAddress.find({ currencyname: symbol }, { address: 1, encData: 1, currencyname: 1 })
    const totalData = await Transaction.find(
      { moveCur: symbol, adminMoveStatus: 0 },
      { toaddress: 1 }
    );
    let userData = await getUnique(totalData, "toaddress");
    let results = [];
    for (let i = 0; i < userData.length; i++) {
      const userAddress = userData[i].toaddress;
      let users = await CoinAddress.findOne(
        { address: userAddress, currencyname: symbol },
        { encData: 1 }
      );
      const userPublicKey = users?.encData;
      // console.log(`${jsonrpc.btcconfig.APIUrl}addrs/${userAddress}/balance?token=${config.BTC_TokenAPI}`)
      const addr_balance = await axios.get(
        `${jsonrpc.btcconfig.APIUrl}addrs/${userAddress}/balance?token=${config.BTC_TokenAPI}`
      );
      const userBalance = addr_balance.data.final_balance;

      const BTC_balance = userBalance / 1e8;

      const keyPairs = bitcoin.ECPair.fromPrivateKey(
        Buffer.from(userPublicKey, "hex")
      );
      if (Number(BTC_balance) >= jsonrpc.btcconfig.minBal) {
        let utxos = await getUTXOs(userAddress);
        if (utxos.length === 0) continue;

        const feeRate = await getRecommendedFeeRate();

        const numInputs = utxos.length;
        const numOutputs = 2;
        const estimatedFee = estimateTxFee(numInputs, numOutputs, feeRate);
        // console.log(userBalance - estimatedFee)
        const transferAmnt = (userBalance - estimatedFee) / 1e8;
        const transferData = await coinTransfer(
          userAddress,
          transferAmnt,
          adminAddress,
          keyPairs
        );
        // console.log('transferData----', transferData)
        if (transferData) {
          await adminHistory(
            userAddress,
            adminAddress,
            transferAmnt,
            symbol,
            transferData
          );
          await adminMovedStatus(userAddress, symbol);
          results.push({ status: true, message: "Admin Transfer Completed" });
          const BTCAdminMoveActivity = await subAdminMethods.adminActivity(
            req,
            ip,
            "AdminMove",
            SuperAdminData?.email,
            SuperAdminData.admin_type,
            symbol,
            `${symbol} moved to Admin Wallet`
          );
        }
      } else {
        results.push({
          status: false,
          message: `You don’t have sufficient balance to move. A minimum of ${jsonrpc.btcconfig.minBal} BTC is required.`,
        });
      }
    }
    return results.length
      ? results
      : [{ status: false, message: "No new BTC deposits found" }];
  } catch (error) {
    console.error("coin Admin Move Error:", error.message);
    return { status: false, message: "Internal Admin Move Error" };
  }
};
