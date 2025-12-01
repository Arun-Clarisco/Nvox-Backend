const cron = require("node-cron");
const config = require('../Config/config')
const userBalance = require("../Modules/userModule/userBalance");
const pairDetails = require("../Modules/userModule/pairData");
const TotalAssetChart = require("../Modules/userModule/userTotalAsset");
let isProcess = false;
const axios = require("axios");
const pairData = require("../Modules/userModule/pairData");


const userLastOneMonthWallet = async () => {
  try {
    const allUsers = await userBalance.find({});

    if (Array.isArray(allUsers)) {
      for (const userBalance of allUsers) {
        let userBalanceObj = {
          USDT: userBalance.USDT_Balance,
          ETH: userBalance.ETH_Balance,
          BTC: userBalance.BTC_Balance,
          SOL: userBalance.SOL_Balance,
          LTC: userBalance.LTC_Balance,
          ADA: userBalance.CARDONA_Balance,
        };

        const totalValueInUSDT = await Promise.all(
          Object.keys(userBalanceObj).map(async (currency) => {
            const pairSymbol = currency === "USDT" ? "USDTUSDT" : `${currency}USDT`;

            const pair = await pairDetails.findOne(
              { symbol: pairSymbol },
              { current_price: 1 }
            );

            if (pair && pair.current_price) {
              const balance = userBalanceObj[currency] || 0;
              const price = pair.current_price;
              return balance * price;
            } else {
              return 0;
            }
          })
        );

        const totalValue = totalValueInUSDT.reduce((acc, val) => acc + val, 0);
        const userOverAllBalance = totalValue + (userBalance.USDT_Balance || 0);

        const today = new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'
        const chartId = userBalance.userId; 
        // console.log("chartId", chartId); 

        const isExistUser = await TotalAssetChart.findOne({ userId: userBalance.userId }); 
        // console.log("isExistUser", isExistUser); 
 

        if (!isExistUser) {
          // Atomic insert with upsert to avoid race condition
          await TotalAssetChart.updateOne(
            { userId: userBalance.userId },
            {
              $setOnInsert: {
                userId: userBalance.userId,
                currentDayPrice: [
                  {
                    day: new Date(),
                    totalInUSD: userOverAllBalance > 0 ? userOverAllBalance : 0,
                  },
                ],
              },
            },
            { upsert: true }
          );
          continue;
        }

        const currentDayPrices = isExistUser.currentDayPrice || [];

        // Check if today's entry already exists
        const indexOfToday = currentDayPrices.findIndex(
          (entry) =>
            new Date(entry.day).toISOString().slice(0, 10) === today
        );

        if (indexOfToday !== -1) {
          // Update existing day's value
          isExistUser.currentDayPrice[indexOfToday].totalInUSD =
            userOverAllBalance > 0 ? userOverAllBalance : 0;
          await isExistUser.save();
        } else {
          // Maintain at most 25 entries
          if (currentDayPrices.length >= 25) {
            currentDayPrices.shift(); // remove oldest
          }

          currentDayPrices.push({
            day: new Date(),
            totalInUSD: userOverAllBalance > 0 ? userOverAllBalance : 0,
          });

          await TotalAssetChart.updateOne(
            { userId: userBalance.userId },
            { $set: { currentDayPrice: currentDayPrices } }
          );
        }

        // Optional: throttle to reduce pressure
        await new Promise((res) => setTimeout(res, 50));
      }
    }
  } catch (error) {
    console.error({ userLastOneMonthWallet: error });
  }
};

const coinMarketCapApi = async () => {
  // console.log("cron---coinMarketCapApi");

  try {
    const url = `https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest`;
    const response = await axios.get(url, {
      headers: {
        "X-CMC_PRO_API_KEY": config.CMC_Api, 
      },
      params: {
        symbol: "USDT",
        convert: "USD",
      },
    });

    // const usdt = response.data.data["USDT"].quote.USD;
    const usdt = response.data.data["USDT"].quote.USD.price;
    // console.log("usdt---", usdt);

    const updateFields = {
      change_24h: usdt.percent_change_24h,
      current_price: usdt.price,
      volume: usdt.volume_change_24h,
      volume_24h_USDT: usdt.volume_24h,
      change_percentage: usdt.percent_change_24h,
    };

    const result = await pairData.findOneAndUpdate(
      { symbol: "USDT" },
      { $set: updateFields },
      { new: true, upsert: true } // `upsert: true` handles both update or create
    );

    // console.log("USDT updated/created ---", result);
  } catch (error) {
    console.error("coinMarketCapApi error:", error.message);
  }
};

cron.schedule('30 23 * * *', async () => {
  // console.log("cron work at 11:30 PM UTC");
  if (isProcess) return;
  isProcess = true;
  await userLastOneMonthWallet();
  isProcess = false;
}, { timezone: "Etc/UTC" });

// cron.schedule("0 0 * * *", async () => {

//     if (isProcess) return;
//     isProcess = true;
//     await userLastOneMonthWallet()
//     isProcess = false;
// }, { timezone: "Etc/UTC" });

//10 Mins
// cron.schedule(
//   "*/10 * * * *",
//   async () => {
//     await coinMarketCapApi();
//   },
//   { timezone: "Etc/UTC" }
// );


cron.schedule(
  "*/5 * * * *",
  async () => {
    await coinMarketCapApi();
  },
  { timezone: "Etc/UTC" }
);

isProcess = false;
