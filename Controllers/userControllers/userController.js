const userBalance = require("../../Modules/userModule/userBalance");
const Transaction = require("../../Modules/userModule/Transaction");

const userUpdateBalance = async (userId, symbol, amount, operation) => {
  try {
    const fieldMap = {
      USDT: "USDT_Balance",
      BTC: "BTC_Balance",
      ETH: "ETH_Balance",
      SOL: "SOL_Balance",
      LTC: "LTC_Balance",
      ADA: "CARDONA_Balance",
      CARDONA: "CARDONA_Balance",
    };

    const balanceField = fieldMap[symbol.toUpperCase()];
    if (!balanceField) return console.log("Invalid currency symbol");

    const updateAmount = operation === "add" ? amount : -amount;

    await userBalance.findOneAndUpdate(
      { userId: userId },
      { $inc: { [balanceField]: updateAmount } },
      { new: true }
    );

    // console.log("User balance updated using $inc...");
  } catch (error) {
    console.error("Error in userUpdateBalance:", error);
  }
};

const adminMovedStatus = async (address, symbol) => {
    // console.log('address------', address, "---symbol---", symbol)
    try {
        await Transaction.updateMany(
            {
                toaddress: address,
                moveCur: symbol,
                adminMoveStatus: 0
            },
            { $set: { adminMoveStatus: 1 } }
        )
        return console.log("admin status updated");
    } catch (error) {
        console.log("Internal Error...")
    }
} 


module.exports = { userUpdateBalance, adminMovedStatus };