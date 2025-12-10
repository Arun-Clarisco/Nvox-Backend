const config = require("../Config/config");
const bitcoin = require('bitcoinjs-lib');
const bip39 = require("bip39");
const { BIP32Factory } = require('bip32');
const assert = require('assert');
const { ECPairFactory } = require("ecpair");
const ecc = require("tiny-secp256k1");
const coininfo = require('coininfo');
const mongoose = require('mongoose')
const CoinAddress = require('../Modules/userModule/CoinAddress');
const ObjectId = mongoose.Types.ObjectId;
const jsonrpc = require('../Config/rpcUrl');
const fs = require('fs');
const path = require('path');
const nodemailer = require("nodemailer");
const hbs = require("nodemailer-express-handlebars");
const { userDepositUpdate, decryptionKey, rejectUserRequest, adminHistory, userHistory } = require('../Controllers/adminControllers/adminController');
const Coindata = require('../Modules/userModule/pairData');
const depositTransaction = require('../Modules/userModule/Transaction');
const depositMail = path.resolve(
  __dirname,
  "../Controllers/EmailTemplates/mailBody/depositMail.txt"
);
const isTestnet = process.env.NETWORK === 'testnet';
const network = isTestnet ? {
  messagePrefix: '\x19Litecoin Signed Message:\n',
  bech32: 'tltc',
  bip32: { public: 0x043587cf, private: 0x04358394 },
  pubKeyHash: 0x6f,
  scriptHash: 0x3a,
  wif: 0xef,
} : {
  messagePrefix: '\x19Litecoin Signed Message:\n',
  bech32: 'ltc',
  bip32: { public: 0x019da462, private: 0x019d9cfe },
  pubKeyHash: 0x30,
  scriptHash: 0x32,
  wif: 0xb0,
}

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
const mempoolJS = require("@mempool/mempool.js");
const AdminSettings = require('../Modules/adminModule/AdminSettings');
const { default: axios } = require('axios');
const rpcUrl = require('../Config/rpcUrl');
const { adminMovedStatus } = require('../Controllers/userControllers/userController');
const subAdminMethods = require("../Controllers/adminControllers/SubAdminController");
const adminUser = require("../Modules/adminModule/AdminModule");
const userDb = require("../Modules/userModule/userModule");

bitcoin.initEccLib(ecc);
const bip32 = BIP32Factory(ecc);
const ECPair = ECPairFactory(ecc);

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


exports.LTCAddress = async (userid) => {
  try {
    const existingAddress = await CoinAddress.findOne({ user_id: new ObjectId(userid), currencyname: "LTC" });
    if (existingAddress) {
      console.log('LTC address already exists for this user.');
      return existingAddress;
    }

    const keyPair = ECPair.makeRandom({ network });
    const { address } = bitcoin.payments.p2pkh({
      pubkey: keyPair.publicKey,
      network: network,
    });
    const walletAddress = address;
    const wif = keyPair.toWIF();

    const baseDir = path.join(__dirname, '../Keystore/');
    const filePath = path.join(baseDir, walletAddress.toLowerCase() + ".json");

    await fs.promises.writeFile(filePath, JSON.stringify({ wif }), 'utf8');


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

exports.LtcDeposit = async (userid, symbol) => {
  try {
    const userData = await userDb.findById({ _id: userid });
    // Get user's Litecoin address from database
    const userAddress = await CoinAddress.findOne({ user_id: userid, currencyname: symbol });
    if (!userAddress) {
      return { success: false, message: "No Litecoin address found for this user.", count: 0 };
    }

    const walletAddress = userAddress.address;

    let previousBlock = userAddress.ltcBlock?.ltc || 0;
    let maxProcessedBlock = previousBlock;

    const { bitcoin: { addresses } } = mempoolJS({
      hostname: "litecoinspace.org",
      network: process.env.NETWORK,
    });


    // fetch txs for this address
    const addressTxs = await addresses.getAddressTxs({ address: walletAddress });

    if (!addressTxs || addressTxs.length === 0) {
      return { success: false, message: "No transactions found for LTC address", count: 0 };
    }

    const sortedTxs = addressTxs.sort((a, b) => {
      const timeA = a.status?.block_time || 0;
      const timeB = b.status?.block_time || 0;
      return timeA - timeB;
    })

    let newDepositCount = 0;

    for (let users of sortedTxs) {
      const blockHeight = users?.status?.block_height;
      if (!blockHeight || blockHeight <= previousBlock) continue;
      let toAddress;
      let amount
      for (const output of users.vout) {
        if (output.scriptpubkey_address === walletAddress) {
          toAddress = output.scriptpubkey_address;
          amount = output.value;
        } else {
          continue;
        }
      }
      if (toAddress !== walletAddress) continue;

      // skip if already recorded
      const existingDeposit = await depositTransaction.findOne({ userId: new ObjectId(userid), txnId: users.txid, type: "Deposit" });
      if (existingDeposit) continue;

      const symbolName = symbol + "USDT";
      const coinData = await Coindata.findOne({ symbol: symbolName });
      const currentPrice = coinData?.current_price || 0;

      const createdDate = new Date(Number(users?.status?.block_time) * 1000);
      const fromAddress = users.vin[0]?.prevout?.scriptpubkey_address || "";
      // const amount = users.vout[0]?.value || 0;
      const transferAmnt = amount / 1e8;
      const usdAmount = parseFloat(currentPrice) * parseFloat(transferAmnt);

      // save deposit
      const newDeposit = new depositTransaction({
        userId: new ObjectId(userid),
        toaddress: toAddress,
        amount: transferAmnt,
        fromAddress,
        fees: "",
        type: "Deposit",
        txnId: users.txid,
        status: 1,
        moveCur: symbol,
        currentDeposit_livePrice: currentPrice,
        usdAmount,
        createdDate,
      });

      const saved = await newDeposit.save();
      if (saved?.status) {
        await userDepositUpdate(userid, transferAmnt, symbol);
        newDepositCount++;

        const datas = fs.readFileSync(depositMail, "utf8");
        let bodyData = datas.toString();
        const getSitesetting = await siteSetting.findOne({});
        const userName = userData.first_name || userData.email;
        const emailCotent = `Your deposit of ${transferAmnt} ${symbol} has been successfully received and updated in your account.`;
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
          "{{TxnId}}": users.txid,
        };
        let emailBody = bodyData;
        for (const key in chars) {
          emailBody = emailBody.replace(new RegExp(key, "g"), chars[key]);
        }
        let subject = `New ${symbol} Deposit Received`;
        PassMailSend(userData.email, subject, emailBody);
      }
      maxProcessedBlock = Math.max(maxProcessedBlock, blockHeight);
    }

    if (maxProcessedBlock > previousBlock) {
      await CoinAddress.updateOne(
        { user_id: userid, currencyname: "LTC" },
        { $set: { "ltcBlock.ltc": maxProcessedBlock } }
      );
    }

    if (newDepositCount > 0) {
      return { success: true, message: `${symbol} recent deposit updated successfully`, count: newDepositCount };
    } else {
      return { success: false, message: "No new LTC deposits found", count: 0 };
    }
  } catch (error) {
    console.error("LtcDeposit Error:", error.message);
    return { success: false, message: "Internal Error", count: 0 };
  }
};


exports.LtcWithdraw = async (userId, data, req) => {
  try {
    let adminAddress;
    const adminId = userId;
    const adminData = await adminUser.findOne({ _id: adminId });
    if (data.type == "approve") {
      if (adminData.admin_type == "SuperAdmin") {
        adminAddress = await AdminSettings.findOne({ userId: userId }, { ltc_address: 1, ltc_key: 1, ltc_seed: 1 })
      } else {
        adminAddress = await AdminSettings.findOne({});
      }
      let adminKey = await decryptionKey(adminAddress?.ltc_key);
      const mnemonic = await decryptionKey(adminAddress?.ltc_seed)
      const resp = await axios.get(`${config.LTC_URL}address/${adminAddress.ltc_address}`)
      let balance = resp.data.chain_stats.funded_txo_sum - resp.data.chain_stats.spent_txo_sum;
      const ltcBalance = balance / 1e8
      if (parseFloat(ltcBalance) > parseFloat(data.amount)) {
        const signed = await coinTransfer(adminKey, data.toaddress, data.amount, adminAddress.ltc_address, mnemonic)
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
      await rejectUserRequest(data, totalAmnt, req, adminId)
      return { status: true, message: "Admin Rejected the User Request" };
    }

  } catch (error) {
    console.error("Litecoin Withdraw Error:", error.message);
    return false;
  }
};

async function getRecommendedFeeRate() {
  const res = await axios.get("https://mempool.space/api/v1/fees/recommended");
  return res.data.fastestFee;
}

async function fetchRawTxHex(utxo) {
  try {
    const txUrl = `${config.LTC_URL}tx/${utxo.txId}/hex`;
    const response = await axios.get(txUrl);
    return response.data;
  } catch (error) {
    console.log("LTC fetchRawTxHex", error);
  }
}

const buildLitecoinTx = async ({
  key,
  utxos,
  toAddress,
  amountSats,
  fromAddress,
  feeSats,
  mnemonic
}) => {
  try {
    const keyPair = ECPair.fromWIF(key, network);
    const pubkey = keyPair.publicKey;
    const p2wpkh = bitcoin.payments.p2wpkh({ pubkey, network });
    const p2sh = bitcoin.payments.p2sh({ redeem: p2wpkh, network });
    const p2pkh = bitcoin.payments.p2pkh({ pubkey, network });


    // detect Taproot
    const xOnlyPubkey = pubkey.slice(1, 33);
    const p2tr = bitcoin.payments.p2tr({
      internalPubkey: xOnlyPubkey,
      network,
    });

    const psbt = new bitcoin.Psbt({ network });

    // detect input type by address prefix
    const addr = fromAddress;
    let tweakedChildNode;
    let TaprootStatus = false;
    for (const utxo of utxos) {
      if (/^(L|M|m|n)/.test(addr)) {
        let rawTxHex = await fetchRawTxHex(utxo);
        // Legacy P2PKH
        psbt.addInput({
          hash: utxo.txId,
          index: utxo.vout,
          nonWitnessUtxo: Buffer.from(rawTxHex, "hex"),
        });
      } else if (/^(3|2|Q)/.test(addr)) {
        // P2SH-P2WPKH
        psbt.addInput({
          hash: utxo.txId,
          index: utxo.vout,
          witnessUtxo: {
            script: p2sh.output,
            value: BigInt(utxo.value),
          },
          redeemScript: p2sh.redeem.output,
        });
      } else if (/^(ltc1q|tltc1q)/.test(addr)) {
        // Native SegWit P2WPKH
        psbt.addInput({
          hash: utxo.txId,
          index: utxo.vout,
          witnessUtxo: {
            script: p2wpkh.output,
            value: BigInt(utxo.value),
          },
        });
      } else if (/^(ltc1p|tltc1p)/.test(addr)) {
        // Taproot P2TR
        const seed = await bip39.mnemonicToSeed(mnemonic);
        const rootKey = bip32.fromSeed(seed, network);
        const path = `m/86'/2'/0'/0/0`;
        const childNode = rootKey.derivePath(path);
        const childNodeXOnlyPubkey = bitcoin.toXOnly(xOnlyPubkey);
        assert.deepEqual(childNodeXOnlyPubkey, xOnlyPubkey);
        assert(p2tr.output);
        assert.strictEqual(p2tr.address, addr);
        tweakedChildNode = childNode.tweak(
          bitcoin.crypto.taggedHash("TapTweak", childNodeXOnlyPubkey)
        );
        TaprootStatus = true;
        psbt.addInput({
          hash: utxo.txId,
          index: utxo.vout,
          witnessUtxo: {
            script: p2tr.output,
            value: BigInt(utxo.value),
          },
          tapInternalKey: bitcoin.toXOnly(xOnlyPubkey),
        });
      } else {
        throw new Error("Unsupported address type: " + addr);
      }
    }
    // output (recipient)
    psbt.addOutput({
      address: toAddress,
      value: BigInt(amountSats),
    });

    // Calculate change
    const inputTotal = utxos.reduce((sum, utxo) => sum + utxo.value, 0);
    const change = inputTotal - amountSats - feeSats;

    if (change > 0) {
      psbt.addOutput({ address: addr, value: BigInt(change) });
    }

    // sign (Taproot requires Schnorr backend)
     utxos.forEach((_, idx) => {
      psbt.signInput(idx, TaprootStatus ? tweakedChildNode : keyPair);
    });

    // const validator = (pubkey, msghash, signature) => {
    //   try {
    //     return ECPair.fromPublicKey(pubkey).verify(msghash, signature); // <-- ECDSA for P2PKH
    //   } catch {
    //     return false;
    //   }
    // };

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
    let isValid = false;
    for (let i = 0; i < psbt.inputCount; i++) {
      isValid = psbt.validateSignaturesOfInput(i, validator);
    }

    if (isValid) {
      psbt.finalizeAllInputs();
      const rawTx = psbt.extractTransaction().toHex();

      return rawTx;
    } else {
      console.log("❌ Transaction aborted due to invalid signature.");
    }
  } catch (error) {
    console.log(error.message)
  }
};

function estimateTxFee(numInputs, numOutputs, feeRate = 10) {
  const size = numInputs * 148 + numOutputs * 34 + 10;
  return size * feeRate; // satoshis
}

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

async function getUTXOs(fromAddress) {
  const url = `${config.LTC_URL}address/${fromAddress}/utxo`;
  const response = await axios.get(url);
  return response.data || [];
}

const coinTransfer = async (key, toAddress, amount, fromAddress, mnemonic) => {
  try {
    const amountSats = Math.round(amount * 1e8);
    const utxosData = await getUTXOs(fromAddress);

    if (!utxosData.length) {
      console.log("No UTXOs found. Please send LTC to this address first.");
      return false;
    }

    const utxos = utxosData.map(u => ({
      txId: u.txid,
      vout: u.vout,
      address: fromAddress,
      value: u.value,
    }));

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
    const feeSats = estimateTxFee(
      selectedWithHex.length,
      numOutputs,
      feeRate
    );

    const rawTx = await buildLitecoinTx({ key, utxos, toAddress, amountSats, fromAddress, feeSats, mnemonic })

    const broadcast = await axios.post(
      `${config.LTC_URL}tx`,
      rawTx,
      {
        headers: { "Content-Type": "text/plain" }
      }
    );

    return broadcast.data;
  } catch (error) {
    console.error('coin Transfer Error:', error.message);
    return false;
  }
}


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

      const resp = await axios.get(`${config.LTC_URL}address/${userAddress}`)
      let balance = resp.data.chain_stats.funded_txo_sum - resp.data.chain_stats.spent_txo_sum;
      let utxos = await getUTXOs(userAddress);
      if (utxos.length === 0) continue;
      const feeRate = await getRecommendedFeeRate();

      const numInputs = utxos.length;
      const numOutputs = 2;
      const estimatedFee = estimateTxFee(numInputs, numOutputs, feeRate);
      const ltcBalance = (balance - estimatedFee) / 1e8;
      if (parseFloat(ltcBalance) >= parseFloat(rpcUrl.ltcconfig.minBal)) {
        const totalAmnt = Number(ltcBalance)

        const signed = await coinTransfer(userPrivateKey, adminAddress, totalAmnt, userAddress)
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