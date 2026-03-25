const mongoose = require("mongoose");
const config = require("../Config/config");
const CoinAddress = require("../Modules/userModule/CoinAddress");
let fs = require("fs");
const path = require("path");
const nodemailer = require("nodemailer");
const hbs = require("nodemailer-express-handlebars");
const Transaction = require("../Modules/userModule/Transaction");
const ObjectId = mongoose.Types.ObjectId;
const AdminSettings = require("../Modules/adminModule/AdminSettings");
const Cardano = require("@emurgo/cardano-serialization-lib-nodejs");
const { BlockFrostAPI } = require("@blockfrost/blockfrost-js");
const {
  decryptionKey,
  userHistory,
  rejectUserRequest,
  userDepositUpdate,
  adminHistory,
} = require("../Controllers/adminControllers/adminController");
const { mnemonicToEntropy, generateMnemonic } = require("bip39");
const bip39 = require("bip39");
const rpcUrl = require("../Config/rpcUrl");
const Coindata = require("../Modules/userModule/pairData");
const { Buffer } = require("buffer");
const blake = require("blakejs");
const {
  adminMovedStatus,
} = require("../Controllers/userControllers/userController");
const subAdminMethods = require("../Controllers/adminControllers/SubAdminController");
const adminUser = require("../Modules/adminModule/AdminModule");
const userDb = require("../Modules/userModule/userModule");

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

// Initialize Blockfrost API
const API = new BlockFrostAPI({
  projectId: rpcUrl.adaconfig.Apikey,
});

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

exports.ADACreateAddress = async (userId) => {
  let existingAddress = await CoinAddress.findOne({
    user_id: new ObjectId(userId),
    currencyname: "ADA",
  });
  if (existingAddress) {
    return existingAddress;
  }

  // Step 1: Generate 24-word mnemonic
  const mnemonic = bip39.generateMnemonic(256); // 24 words
  const entropy = bip39.mnemonicToEntropy(mnemonic);

  // Step 2: Convert mnemonic to root key
  const rootKey = Cardano.Bip32PrivateKey.from_bip39_entropy(
    Buffer.from(entropy, "hex"),
    Buffer.from("") // empty password
  );

  const accountKey = rootKey
    .derive(1852 | 0x80000000) // purpose
    .derive(1815 | 0x80000000) // coin type (ADA)
    .derive(0 | 0x80000000); // account index 0

  const paymentKey = accountKey
    .derive(0) // external chain
    .derive(0); // address index 0

  const paymentPubKey = paymentKey.to_public();
  const stakeKey = accountKey.derive(2).derive(0);
  const stakePubKey = stakeKey.to_public();

  const paymentCred = Cardano.Credential.from_keyhash(
    paymentPubKey.to_raw_key().hash()
  );
  const stakeCred = Cardano.Credential.from_keyhash(
    stakePubKey.to_raw_key().hash()
  );

  const baseAddr = Cardano.BaseAddress.new(
    rpcUrl.adaconfig.network,
    paymentCred,
    stakeCred
  ); // 0 = Testnet
  const address = baseAddr.to_address().to_bech32();

  const keystore = Buffer.from(mnemonic).toString("hex");
  const baseDir = path.join(__dirname, "../Keystore/");
  try {
    if (!fs.existsSync(baseDir)) {
      fs.mkdirSync(baseDir, { recursive: true });
    }
    const filePath = path.join(baseDir, address.toLocaleLowerCase() + ".json");
    await fs.promises.writeFile(filePath, JSON.stringify(keystore), "utf8");

    const newAddress = new CoinAddress({
      user_id: userId,
      address: address,
      currencyname: "ADA",
      encData: mnemonic,
    });
    await newAddress.save();

    return newAddress;
  } catch (err) {
    // console.log("LTC CreateAddress : err : ", err)
    // return res.status(500).json({ error: "Internal Server Error" });
  }
};

exports.ADADeposit = async (userid, symbol) => {
  try {
    const userData = await userDb.findById({ _id: userid });

    if (!userid) {
      return { success: false, message: "User ID is required", count: 0 };
    }

    const userAddress = await CoinAddress.findOne({
      user_id: userid,
      currencyname: "ADA",
    });
    if (!userAddress) {
      return {
        success: false,
        message: "No Cardano address found for this user.",
        count: 0,
      };
    }

    const walletAddress = userAddress.address;
    const adaBlockNumber = userAddress.adaBlock?.ada || 0;

    // fetch transactions
    const transactions = await API.addressesTransactions(walletAddress);
    if (!transactions || transactions.length === 0) {
      return { success: false, message: "No ADA transactions found", count: 0 };
    }

    // filter for only new transactions
    const sortedTxs = transactions.filter(
      (tx) => tx.block_height >= adaBlockNumber
    );
    if (sortedTxs.length === 0) {
      return { success: false, message: "No new ADA deposits found", count: 0 };
    }

    let maxProcessedSlot = adaBlockNumber;
    let newDepositCount = 0;

    for (const latestTx of sortedTxs) {
      maxProcessedSlot = Math.max(maxProcessedSlot, latestTx.block_height);

      // skip if already recorded
      const alreadyExists = await Transaction.findOne({
        txnId: latestTx.tx_hash,
        type: "Deposit",
      });
      if (alreadyExists) continue;

      const txDetails = await API.txsUtxos(latestTx.tx_hash);

      // calculate amount received
      let receivedAmount = 0;
      txDetails.outputs.forEach((output) => {
        if (output.address === walletAddress) {
          receivedAmount += Number(output.amount[0].quantity);
        }
      });

      if (receivedAmount === 0) continue;

      const amount = receivedAmount / 1e6;
      const confirmations = latestTx.confirmations || 0;
      const status = confirmations >= 3 ? 0 : 1;

      const Symbol = symbol + "USDT";
      const coinData = await Coindata.findOne({ symbol: Symbol });
      const currentPrice = coinData?.current_price || 0;

      const usdAmount = parseFloat(currentPrice) * parseFloat(amount);

      // save deposit
      const newDeposit = new Transaction({
        userId: userid,
        currencyName: "ADA",
        toaddress: walletAddress,
        fromAddress: txDetails.inputs[0].address,
        amount,
        txnId: txDetails.hash,
        moveCur: symbol,
        currentDeposit_livePrice: currentPrice,
        usdAmount,
        confirmations,
        status,
        type: "Deposit",
      });

      const saved = await newDeposit.save();
      if (saved?.status) {
        await userDepositUpdate(userid, amount, symbol);
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
          "{{TxnId}}": txDetails.hash,
        };
        let emailBody = bodyData;
        for (const key in chars) {
          emailBody = emailBody.replace(new RegExp(key, "g"), chars[key]);
        }
        let subject = `New ${symbol} Deposit Received`;
        PassMailSend(userData.email, subject, emailBody);
      }
    }

    // update last processed block
    if (maxProcessedSlot > adaBlockNumber) {
      await CoinAddress.updateOne(
        { user_id: userid, currencyname: "ADA" },
        { $set: { "adaBlock.ada": maxProcessedSlot } }
      );
    }

    if (newDepositCount > 0) {
      return {
        success: true,
        message: `${symbol} recent deposit updated successfully`,
        count: newDepositCount,
      };
    } else {
      return { success: false, message: "No new ADA deposits found", count: 0 };
    }
  } catch (error) {
    console.error("Error checking Cardano deposit:", error);
    return { success: false, message: "Internal Error", count: 0 };
  }
};

async function getBalance(address) {
  try {
    const utxos = await API.addressesUtxos(address);
    let total = 0;

    for (const utxo of utxos) {
      for (const amount of utxo.amount) {
        if (amount.unit === "lovelace") {
          total += parseInt(amount.quantity);
        }
      }
    }

    const totalAmount = total / 1e6;
    return totalAmount;
  } catch (err) {
    console.error("Error fetching balance:", err.message);
  }
}

exports.AdaWithdraw = async (userId, data, req) => {
  try {
    const adminId = userId;
    const adminData = await adminUser.findOne({ _id: adminId });

    if (data.type == "approve") {

      let adminAddress;
      if (data.type == "approve") {
        if (adminId && adminData.admin_type == "SuperAdmin") {
          adminAddress = await AdminSettings.findOne(
            { userId: userId },
            { ada_address: 1, ada_key: 1 }
          );
        } else {
          adminAddress = await AdminSettings.findOne({});
        }
      }

      let adminKey = await decryptionKey(adminAddress?.ada_key);

      const fromAddress = adminAddress?.ada_address;
      const adaBalance = await getBalance(fromAddress);


      if (parseFloat(adaBalance) > parseFloat(data.amount)) {
        const totalAmnt = Math.floor(Number(data.amount) * 1e6);
        const sendAmount = Cardano.BigNum.from_str(totalAmnt.toString());
        const signed = await coinTransferWithdraw(
          fromAddress,
          data.toaddress,
          sendAmount,
          adminKey
        );
        if (signed) {
          const AdaSaveData = await userHistory(
            data.id,
            fromAddress,
            signed,
            2
          );
          const withdrawAdaUser = await userDb.findById({
            _id: AdaSaveData.userId,
          });
          if (adminData.admin_type == "SuperAdmin") {
            const AdaAdminActivity = await subAdminMethods.adminActivity(
              req,
              data.ip,
              "withdrawRequest",
              adminData.email,
              adminData.admin_type,
              withdrawAdaUser.email,
              `${AdaSaveData.moveCur} withdraw Approve Successfully!`
            );
          } else {
            const AdaAdminActivity = await subAdminMethods.adminActivity(
              req,
              data.ip,
              "withdrawRequest",
              adminData.email,
              adminData.adminName,
              withdrawAdaUser.email,
              `${AdaSaveData.moveCur} withdraw Approve Successfully!`
            );
          }

          const datas = fs.readFileSync(approveEmail, "utf8");
          let bodyData = datas.toString();
          const getSitesetting = await siteSetting.findOne({});
          const emailCotent = `Your ${data.amount} ${AdaSaveData.moveCur} withdraw request Approved Successfully!`;
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
          PassMailSend(withdrawAdaUser.email, subject, bodyData);

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
    console.error("Ada Withdraw Error:", error);
    return false;
  }
};

exports.Ada_adminMove = async (ip, adminId, symbol, req) => {
  try {
    const SuperAdminData = await adminUser.findOne({ _id: adminId });

    const adminData = await AdminSettings.findOne(
      { userId: adminId },
      { ada_address: 1 }
    );

    const adminAddress = adminData.ada_address;
    const totalData = await Transaction.find(
      { moveCur: symbol, adminMoveStatus: 0 },
      { toaddress: 1 }
    );

    let userData = await getUnique(totalData, "toaddress");

    let results = [];
    for (let i = 0; i < userData.length; i++) {
      const userAddress = userData[i].toaddress;
      let users = await CoinAddress.findOne(
        { currencyname: symbol, address: userAddress },
        { encData: 1 }
      );

      const userPrivateKey = users.encData;

      const adaBalance = await getBalance(userAddress);


      if (parseFloat(adaBalance) >= parseFloat(rpcUrl.adaconfig.minBal)) {
        const totalAmnt = Number(adaBalance) - 0.2; // Subtracting 0.2 ADA as a buffer

        const weiAmount = Math.round(totalAmnt * 1e6);

        const sendAmount = Cardano.BigNum.from_str(weiAmount.toString());

        const outputValue = Cardano.Value.new(
          Cardano.BigNum.from_str(weiAmount.toString())
        );

        const output = Cardano.TransactionOutput.new(
          Cardano.Address.from_bech32(adminAddress),
          Cardano.Value.new(sendAmount)
        );

        const dataCost = Cardano.DataCost.new_coins_per_byte(
          Cardano.BigNum.from_str("4310")
        );

        const minAda = Cardano.min_ada_for_output(output, dataCost);
        const whywrong = outputValue.coin().compare(minAda) < 0;

        if (outputValue.coin().compare(minAda) < 0) {
          results.push({
            status: false,
            message: "No eligible deposits to move.",
          });
        } else {

          const signed = await coinTransfer(
            userAddress,
            adminAddress,
            sendAmount,
            userPrivateKey
          );

          if (signed) {
            const adahistorysave = await adminHistory(
              userAddress,
              adminAddress,
              totalAmnt,
              symbol,
              signed
            );

            const AdaAdminMoveData = await adminMovedStatus(
              userAddress,
              symbol
            );

            results.push({ status: true, message: "Admin Transfer Completed" });
            const AdaAdminMoveActivity = await subAdminMethods.adminActivity(
              req,
              ip,
              "AdminMove",
              SuperAdminData?.email,
              SuperAdminData.admin_type,
              symbol,
              `${symbol} moved to Admin Wallet`
            );
          }
        }
      } else {
        results.push({
          status: false,
          message: `You don’t have sufficient balance to move. A minimum of ${rpcUrl.adaconfig.minBal} ADA is required. `,
        });
      }
    }

    return results.length
      ? results
      : [{ status: false, message: "No new ADA deposits found" }];
  } catch (error) {
    console.error("coin Admin Move Error:", error.message);
    return [{ status: false, message: "Internal Admin Move Error" }];
  }
};

const coinTransferWithdraw = async (
  senderAddrStr,
  toAddr,
  sendAmount,
  mnemonic
) => {
  try {
    const entropy = bip39.mnemonicToEntropy(mnemonic);

    const rootKey = Cardano.Bip32PrivateKey.from_bip39_entropy(
      Buffer.from(entropy, "hex"),
      Buffer.from("")
    );

    const accountKey = rootKey
      .derive(1852 | 0x80000000)
      .derive(1815 | 0x80000000)
      .derive(0 | 0x80000000);

    const paymentKey = accountKey.derive(0).derive(0).to_raw_key();
    const paymentKeyHash = paymentKey.to_public().hash();

    // UTXOs
    const utxos = await API.addressesUtxos(senderAddrStr);
    if (utxos.length === 0) {
      console.error("No UTXOs found for this address.");
      return;
    }

    // --- Setup Transaction Builder ---
    const cfg = Cardano.TransactionBuilderConfigBuilder.new()
      .fee_algo(
        Cardano.LinearFee.new(
          Cardano.BigNum.from_str("44"),
          Cardano.BigNum.from_str("155381")
        )
      )
      .coins_per_utxo_byte(Cardano.BigNum.from_str("4310"))
      .pool_deposit(Cardano.BigNum.from_str("500000000"))
      .key_deposit(Cardano.BigNum.from_str("2000000"))
      .max_value_size(5000)
      .max_tx_size(16384)
      .build();

    const builder = Cardano.TransactionBuilder.new(cfg);

    // --- Add inputs ---
    for (const u of utxos) {
      const input = Cardano.TransactionInput.new(
        Cardano.TransactionHash.from_bytes(Buffer.from(u.tx_hash, "hex")),
        u.output_index
      );
      const value = Cardano.Value.new(
        Cardano.BigNum.from_str(
          u.amount.find((a) => a.unit === "lovelace").quantity
        )
      );
      builder.add_key_input(paymentKeyHash, input, value);
    }

    // --- Add output ---
    builder.add_output(
      Cardano.TransactionOutput.new(
        Cardano.Address.from_bech32(toAddr),
        Cardano.Value.new(sendAmount)
      )
    );

    // Add change
    builder.add_change_if_needed(Cardano.Address.from_bech32(senderAddrStr));

    // --- Build tx body ---
    const txBody = builder.build();

    // Step 2: Manually compute the hash (same as `hash_transaction`)
    const txBodyBytes = txBody.to_bytes();
    const txHashBytes = blake.blake2b(txBodyBytes, null, 32); // 32 bytes = 256-bit hash
    const txHashHex = Buffer.from(txHashBytes).toString("hex");

    // Convert the hash into TransactionHash format for witness signing
    const txHash = Cardano.TransactionHash.from_bytes(txHashBytes);

    // Step 3: Sign the transaction
    const witnesses = Cardano.TransactionWitnessSet.new();
    const vkeyWitnesses = Cardano.Vkeywitnesses.new();
    const witness = Cardano.make_vkey_witness(txHash, paymentKey);
    vkeyWitnesses.add(witness);
    witnesses.set_vkeys(vkeyWitnesses);

    // Step 4: Build final signed transaction
    const signedTx = Cardano.Transaction.new(txBody, witnesses);
    const signedTxHex = Buffer.from(signedTx.to_bytes()).toString("hex");

    // Step 5: Submit the transaction
    const txHashResult = await API.txSubmit(signedTxHex);
    return txHashResult;
  } catch (error) {
    console.error("coin Transfer Error:", error);
    return false;
  }
};

const coinTransfer = async (senderAddrStr, toAddr, sendAmount, mnemonic) => {
  try {
    const entropy = bip39.mnemonicToEntropy(mnemonic);

    const rootKey = Cardano.Bip32PrivateKey.from_bip39_entropy(
      Buffer.from(entropy, "hex"),
      Buffer.from("")
    );

    const accountKey = rootKey
      .derive(1852 | 0x80000000)
      .derive(1815 | 0x80000000)
      .derive(0 | 0x80000000);

    const paymentKey = accountKey.derive(0).derive(0).to_raw_key();
    const paymentKeyHash = paymentKey.to_public().hash();

    // --- UTXOs ---
    const utxos = await API.addressesUtxos(senderAddrStr);
    if (utxos.length === 0) {
      console.error("No UTXOs found for this address.");
      return;
    }

    // --- Setup Transaction Builder ---
    const cfg = Cardano.TransactionBuilderConfigBuilder.new()
      .fee_algo(
        Cardano.LinearFee.new(
          Cardano.BigNum.from_str("44"),
          Cardano.BigNum.from_str("155381")
        )
      )
      .coins_per_utxo_byte(Cardano.BigNum.from_str("4310"))
      .pool_deposit(Cardano.BigNum.from_str("500000000"))
      .key_deposit(Cardano.BigNum.from_str("2000000"))
      .max_value_size(5000)
      .max_tx_size(16384)
      .build();

    const builder = Cardano.TransactionBuilder.new(cfg);

    // --- Add inputs & sum total input amount ---
    let totalInput = 0n;
    for (const u of utxos) {
      const input = Cardano.TransactionInput.new(
        Cardano.TransactionHash.from_bytes(Buffer.from(u.tx_hash, "hex")),
        u.output_index
      );
      const lovelaceAmount = BigInt(
        u.amount.find((a) => a.unit === "lovelace").quantity
      );
      const value = Cardano.Value.new(
        Cardano.BigNum.from_str(lovelaceAmount.toString())
      );
      totalInput += lovelaceAmount;
      builder.add_key_input(paymentKeyHash, input, value);
    }
    // --- Add dummy output to estimate fee ---
    builder.add_output(
      Cardano.TransactionOutput.new(
        Cardano.Address.from_bech32(toAddr),
        Cardano.Value.new(Cardano.BigNum.from_str("1000000")) // dummy for now
      )
    );

    // --- Add dummy change (optional but safe) ---
    builder.add_change_if_needed(Cardano.Address.from_bech32(senderAddrStr));

    // --- Estimate min fee ---
    const dummyWitness = Cardano.make_vkey_witness(
      Cardano.TransactionHash.from_bytes(new Uint8Array(32)), // dummy tx hash
      paymentKey
    );
    const vkeyWitnesses = Cardano.Vkeywitnesses.new();
    vkeyWitnesses.add(dummyWitness);
    const witnessSet = Cardano.TransactionWitnessSet.new();
    witnessSet.set_vkeys(vkeyWitnesses);

    const fee = builder.min_fee().to_str(); // returns BigNum, convert to string

    const feeBigInt = BigInt(fee);

    // --- Calculate actual send amount = totalInput - fee ---
    const adjustedSendAmount = totalInput - feeBigInt;

    if (adjustedSendAmount <= 0n) {
      console.error("Insufficient ADA after accounting for transaction fee.");
      return;
    }

    // --- Rebuild with actual output ---
    const finalBuilder = Cardano.TransactionBuilder.new(cfg);

    for (const u of utxos) {
      const input = Cardano.TransactionInput.new(
        Cardano.TransactionHash.from_bytes(Buffer.from(u.tx_hash, "hex")),
        u.output_index
      );
      const lovelaceAmount = BigInt(
        u.amount.find((a) => a.unit === "lovelace").quantity
      );
      const value = Cardano.Value.new(
        Cardano.BigNum.from_str(lovelaceAmount.toString())
      );
      finalBuilder.add_key_input(paymentKeyHash, input, value);
    }

    finalBuilder.add_output(
      Cardano.TransactionOutput.new(
        Cardano.Address.from_bech32(toAddr),
        Cardano.Value.new(
          Cardano.BigNum.from_str(adjustedSendAmount.toString())
        )
      )
    );

    finalBuilder.add_change_if_needed(
      Cardano.Address.from_bech32(senderAddrStr)
    );

    const txBody = finalBuilder.build();
    const txHashBytes = blake.blake2b(txBody.to_bytes(), null, 32);
    const txHash = Cardano.TransactionHash.from_bytes(txHashBytes);

    const witnessesFinal = Cardano.TransactionWitnessSet.new();
    const finalVkeyWitnesses = Cardano.Vkeywitnesses.new();
    finalVkeyWitnesses.add(Cardano.make_vkey_witness(txHash, paymentKey));
    witnessesFinal.set_vkeys(finalVkeyWitnesses);
    const signedTx = Cardano.Transaction.new(txBody, witnessesFinal);
    const signedTxHex = Buffer.from(signedTx.to_bytes()).toString("hex");
    const txHashResult = await API.txSubmit(signedTxHex);
    return txHashResult;
  } catch (error) {
    console.error("coin Transfer Error:", error);
    return false;
  }
};
