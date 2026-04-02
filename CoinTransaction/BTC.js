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
const bip39 = require("bip39");
const { BIP32Factory } = require('bip32');
const assert = require('assert');
const { ECPairFactory } = require('ecpair');
const ecc = require("tiny-secp256k1");
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
const crypto = require("crypto");
const {
  decryptionKey,
  userHistory,
  userDepositUpdate,
  rejectUserRequest,
  currencyData,
  adminHistory,
} = require("../Controllers/adminControllers/adminController");
const nodeCrypto = require("crypto");

if (!globalThis.crypto) {
  if (nodeCrypto.webcrypto) {
    globalThis.crypto = nodeCrypto.webcrypto;
  } else {
    globalThis.crypto = {
      getRandomValues: (typedArray) => {
        const buf = nodeCrypto.randomBytes(typedArray.length);
        typedArray.set(buf);
        return typedArray;
      }
    };
  }
}
const AdminSettings = require("../Modules/adminModule/AdminSettings");
const Coindata = require("../Modules/userModule/pairData");
const {
  adminMovedStatus,
} = require("../Controllers/userControllers/userController");
const config = require("../Config/config");
const primaryConfig = config.primarySmtp;
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
const { addressesExtended } = require("@blockfrost/blockfrost-js/lib/endpoints/api/addresses");
const { SendMailClient } = require("zeptomail");

const zepto_url = config.ZEPTOMAIL_URL;
const zepto_token = config.ZEPTOMAIL_TOKEN;

const mail_Client = new SendMailClient({ url: zepto_url, token: zepto_token });

bitcoin.initEccLib(ecc);
const bip32 = BIP32Factory(ecc);
const ECPair = ECPairFactory(ecc);


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
    let existingAddress = await CoinAddress.findOne({
      user_id: new ObjectId(userid),
      currencyname: "BTC",
    });
    if (existingAddress) {
      console.log("BTC address already exists for this user.");
      return existingAddress;
    }
    const keyPairCreation = ECPair.makeRandom({ network: btcnetwork });
    if (!keyPairCreation.privateKey) {
      return { error: "Failed to generate private key" };
    }
    const privateKeyHex = Buffer.from(keyPairCreation.privateKey).toString("hex");

    const { address } = bitcoin.payments.p2wpkh({
      pubkey: keyPairCreation.publicKey,
      network: btcnetwork,
    });
    if (!address) {
      return { error: "Failed to generate wallet address" };
    }

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

    const newAddress = new CoinAddress({
      user_id: userid,
      address: address,
      currencyname: "BTC",
      encData: privateKeyHex,
    });

    await newAddress.save();

    return newAddress;
  } catch (err) {
    console.error("BTC CreateAddress : err :", err);
    return false;
  }
};


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
    let adminAddress;

    if (data.type == "approve") {
      if (adminData.admin_type == "SuperAdmin") {
        adminAddress = await AdminSettings.findOne(
          { userId: userId },
          { btc_address: 1, btc_publicKey: 1, btc_seed: 1 }
        );
      } else {
        adminAddress = await AdminSettings.findOne({});
      }

      let adminPublicKey = await decryptionKey(adminAddress?.btc_publicKey);

      const decoded = wif.decode(adminPublicKey);
      // console.log('Decoded WIF:', decoded);
      const privateKeyBuffer = Buffer.from(decoded.privateKey);
      // console.log('privateKeyBuffer:', privateKeyBuffer.toString('hex'));
      const keyPair = ECPair.fromPrivateKey(privateKeyBuffer, {
        network: btcnetwork,
      });
      const keyPairs = ECPair.fromPrivateKey(
        Buffer.from(keyPair.privateKey, "hex")
      );
      const mnemonic = await decryptionKey(adminAddress?.btc_seed)
      const addr_balance = await axios.get(
        `${jsonrpc.btcconfig.APIUrl}addrs/${adminAddress?.btc_address}/balance?token=${config.BTC_TokenAPI}`
      );
      const adminBalance = addr_balance.data.balance;

      const BTC_balance = adminBalance / 1e8;
      // console.log(BTC_balance, data.amount)

      if (parseFloat(BTC_balance) > parseFloat(data.amount)) {
        const transferData = await coinTransfer(
          adminAddress?.btc_address,
          data.amount,
          data.toaddress,
          keyPairs,
          mnemonic
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

// function validator(pubkey, msghash, signature) {
//   return ECPair.fromPublicKey(pubkey).verify(msghash, signature);
// }

function validator(pubkey, msghash, sig) {
  try {
    if (pubkey.length === 32) {
      const full = Buffer.concat([Buffer.from([0x02]), pubkey]);
      return ECPair.fromPublicKey(full).verifySchnorr(msghash, sig);
    }

    return ECPair.fromPublicKey(pubkey).verify(msghash, sig);
  } catch (err) {
    console.error("Validator error:", err.message);
    return false;
  }
}


function validateAllSignatures(psbt) {
  try {
    for (let i = 0; i < psbt.inputCount; i++) {
      const valid = psbt.validateSignaturesOfInput(i, validator);
      if (!valid) {
        return false;
      }
    }
    return true;
  } catch (err) {
    console.error("⚠️ Signature validation failed:", err.message);
    return false;
  }
}


// Build, sign and return raw tx hex
async function buildTransaction(
  selectedUTXOs,
  toAddress,
  amountSats,
  changeAddress,
  feeSats,
  keyPair,
  mnemonic
) {
  const psbt = new bitcoin.Psbt({ network: btcnetwork });
  // Add inputs
  // selectedUTXOs.forEach((utxo) => {
  //   psbt.addInput({
  //     hash: utxo.tx_hash,
  //     index: utxo.tx_output_n,
  //     nonWitnessUtxo: Buffer.from(utxo.rawTxHex, "hex"),
  //   });
  // });
  let tweakedChildNode;
  let TaprootStatus = false;

  for (const utxo of selectedUTXOs) {
    const { tx_hash, tx_output_n, value, rawTxHex } = utxo;
    const input = {
      hash: tx_hash,
      index: tx_output_n,
    };
    // Detect and assign correct fields
    if (/^(1|m|n)/.test(changeAddress)) {
      // Legacy P2PKH
      const p2pkh = bitcoin.payments.p2pkh({
        pubkey: keyPair.publicKey,
        network: btcnetwork,
      });

      if (!rawTxHex)
        throw new Error(
          `Legacy address ${changeAddress} needs full rawTxHex for nonWitnessUtxo`
        );

      input.nonWitnessUtxo = Buffer.from(rawTxHex, "hex");
    } else if (/^(3|2)/.test(changeAddress)) {
      // P2SH-P2WPKH
      const p2wpkh = bitcoin.payments.p2wpkh({
        pubkey: keyPair.publicKey,
        network: btcnetwork,
      });
      const p2sh = bitcoin.payments.p2sh({
        redeem: p2wpkh,
        network: btcnetwork,
      });
      input.witnessUtxo = { script: p2sh.output, value: BigInt(value) };
      input.redeemScript = p2sh.redeem.output;
    } else if (/^(bc1q|tb1q)/.test(changeAddress)) {
      // Native SegWit P2WPKH
      const p2wpkh = bitcoin.payments.p2wpkh({
        pubkey: keyPair.publicKey,
        network: btcnetwork,
      });

      input.witnessUtxo = { script: p2wpkh.output, value: BigInt(value) };
    } else if (/^(bc1p|tb1p)/.test(changeAddress)) {
      // Taproot (P2TR)
      const seed = await bip39.mnemonicToSeed(mnemonic);
      const rootKey = bip32.fromSeed(seed, btcnetwork);
      const path = `m/86'/0'/0'/0/0`;
      const childNode = rootKey.derivePath(path);
      const internalPubkey = keyPair.publicKey.slice(1, 33);
      const childNodeXOnlyPubkey = bitcoin.toXOnly(internalPubkey);
      assert.deepEqual(childNodeXOnlyPubkey, internalPubkey);
      const p2tr = bitcoin.payments.p2tr({
        internalPubkey: internalPubkey,
        network: btcnetwork,
      });
      input.witnessUtxo = {
        script: p2tr.output,
        value: BigInt(value),
      };
      input.tapInternalKey = bitcoin.toXOnly(internalPubkey),
      assert(p2tr.output);
      assert.strictEqual(p2tr.address, changeAddress);
      tweakedChildNode = childNode.tweak(
        bitcoin.crypto.taggedHash("TapTweak", childNodeXOnlyPubkey)
      );
      TaprootStatus = true;
    } else {
      throw new Error("Unsupported address format: " + changeAddress);
    }

    psbt.addInput(input);
  }


  // Add output to recipient
  psbt.addOutput({ address: toAddress, value: BigInt(amountSats) });

  // Calculate change
  const inputTotal = selectedUTXOs.reduce((sum, utxo) => sum + utxo.value, 0);
  const change = inputTotal - amountSats - feeSats;

  if (change > 0) {
    psbt.addOutput({ address: changeAddress, value: BigInt(change) });
  }

  // Sign all inputs
  for (let i = 0; i < selectedUTXOs.length; i++) {
    psbt.signInput(i, TaprootStatus ? tweakedChildNode : keyPair);
  }

  // Validate signatures

  if (validateAllSignatures(psbt)) {
    psbt.finalizeAllInputs();
    const tx = psbt.extractTransaction();

    return tx.toHex()
  } else {
    console.log("❌ Transaction aborted due to invalid signature.");
  }
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

async function coinTransfer(fromAddress, amountBTC, toAddress, keyPair, mnemonic) {
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
    const rawTxHex = await buildTransaction(
      selectedWithHex,
      toAddress,
      amountSats,
      fromAddress,
      actualFee,
      keyPair,
      mnemonic
    );

    // Step 8: Broadcast transaction
    const result = await broadcastTx(rawTxHex);
    // console.log('Transaction broadcasted! TX Hash:', result.tx.hash);
    return result.tx.hash;
  } catch (error) {
    console.error("Transfer failed:", error.message);
    // throw error;
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

      const keyPairs = ECPair.fromPrivateKey(
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
