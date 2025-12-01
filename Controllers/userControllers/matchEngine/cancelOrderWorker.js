const mongoose = require('mongoose');
const Order = require("../../../Modules/userModule/tradeOrder");
const updateBalance = require("../../../Modules/userModule/userBalance");
const { userUpdateBalance } = require("../userController");
const MappingOrders = require("../../../Modules/userModule/MappingOrders");
const TradeOrderHistory = require("../../../Modules/userModule/tradeOrder");
const ObjectId = mongoose.Types.ObjectId;


exports.cancelOrderByWorker = async (id, socket) => {
    // console.log("cancelOrderByWorker data---", id, typeof id);
    try {
        let baseSymbol;
        const findOrderData = await Order.findOneAndUpdate(
            {
                _id: new ObjectId(id),
                status: { $in: ['active', 'partially'] }
            },
            {
                $set: { status: 'processing' }
            },
            {
                new: true
            }
        );


        if (!findOrderData) {
            return socket.emit("orderCancelled", { status: false, message: "Order not found" });
        }

        if (findOrderData.pairName === "ADAUSDT") {
            baseSymbol = "CARDONA";
        } else {
            baseSymbol = findOrderData.pairName.substring(0, 3); // default fallback
        }

        let cancelAmount, symbol;
        const userBalanceBefore = await updateBalance.findOne({ userId: findOrderData.userId });

        let beforeUsdtBal = userBalanceBefore?.USDT_Balance || 0;
        let beforePairBal = userBalanceBefore?.[`${baseSymbol}_Balance`] || 0;

        if (findOrderData.type === "buy") {
            symbol = findOrderData.pairName.substring(3, 7);
            cancelAmount = parseFloat(findOrderData.pendingAmnt) * parseFloat(findOrderData.price);
        } else if (findOrderData.type === "sell") {
            symbol = findOrderData.pairName.substring(0, 3);
            cancelAmount = parseFloat(findOrderData.pendingAmnt);
        }

        await userUpdateBalance(findOrderData.userId, symbol, parseFloat(cancelAmount), "add");

        const userBalanceAfter = await updateBalance.findOne({ userId: findOrderData.userId });

        let afterUsdtBal = userBalanceAfter?.USDT_Balance || 0;
        let afterPairBal = userBalanceAfter?.[`${baseSymbol}_Balance`] || 0;

        const mappingData = {
            dateTime: new Date(),
            pair: findOrderData.pair,
            pairName: findOrderData.pairName,
            tradePrice: findOrderData.price,
            filledAmount: findOrderData.pendingAmnt,
            total: parseFloat(findOrderData.price) * parseFloat(findOrderData.pendingAmnt),
            orderType: findOrderData.orderType,
            orderState: findOrderData.type,
            role: findOrderData.feeStatus,
            status: "cancelled",
            beforeUsdtBal,
            afterUsdtBal,
            beforePairBal,
            afterPairBal
        };


        if (findOrderData.type === "buy") {
            mappingData.buyOrderId = findOrderData._id;
            mappingData.buyerUserId = findOrderData.userId;
            mappingData.buyPrice = findOrderData.price;
        } else {
            mappingData.sellOrderId = findOrderData._id;
            mappingData.sellerUserId = findOrderData.userId;
            mappingData.sellPrice = findOrderData.price;

        }

        await MappingOrders.create(mappingData);

        if (findOrderData.status == "partially") {
            let totalAmount = findOrderData.price * findOrderData.pendingAmnt;
            const cancelledOrder = {
                userId: findOrderData.userId,
                amount: findOrderData.pendingAmnt,
                filledAmount: 0,
                pendingAmnt: findOrderData.pendingAmnt,
                price: findOrderData.price,
                usdPrice: findOrderData.usdPrice,
                totalUsdPrice: findOrderData.totalUsdPrice,
                type: findOrderData.type,
                total: totalAmount,
                beforeUsdtBal: findOrderData.beforeUsdtBal,
                beforePairBal: findOrderData.beforePairBal,
                creditAmount: findOrderData.filledAmount,
                fee: 0,
                feeStatus: "",
                orderType: findOrderData.orderType,
                dateTime: new Date(),
                pair: findOrderData.pair,
                pairName: findOrderData.pairName,
                status: 'partially cancelled',
                referenceId: new mongoose.Types.ObjectId(),
                isProcessed: false,
                isProcessing: false,
                updateAt: new Date(),
            };

            await TradeOrderHistory.create(cancelledOrder);
        }



        const updatedOrder = await Order.findOneAndUpdate(
            { _id: findOrderData._id },
            { $set: { status: findOrderData.amount === findOrderData.pendingAmnt ? "cancelled" : "filled", updateAt: new Date(), } },
            { new: true }
        );

        if (updatedOrder) {
            // console.log("cancelorder>>>socket")
            socket.emit("orderCancelled", { status: true, message: "Your order has been cancelled and the amount has been credited to your wallet", orderId: updatedOrder._id });
        } else {
            socket.emit("orderCancelled", { status: false, message: "Cannot cancel the order" });
        }
    } catch (error) {
        console.error("Error in Cancel Order:", error);
        socket.emit("orderCancelled", { status: false, message: "Internal server error" });
    }
};


exports.cancelOrderByWorker1 = async (id) => {
    // console.log("cancelOrderByWorker data---", id, typeof id);
    try {
        let baseSymbol;

        const findOrderData = await Order.findOneAndUpdate(
            {
                _id: new ObjectId(id),
                status: { $in: ['active', 'partially'] }
            },
            {
                $set: { status: 'processing' }
            },
            {
                new: true
            }
        );


        if (!findOrderData) {
            return { status: false, message: "Order not found" };
        }

        if (findOrderData.pairName === "ADAUSDT") {
            baseSymbol = "CARDONA";
        } else {
            baseSymbol = findOrderData.pairName.substring(0, 3); // default fallback
        }

        let cancelAmount, symbol;
        const userBalanceBefore = await updateBalance.findOne({ userId: findOrderData.userId });

        let beforeUsdtBal = userBalanceBefore?.USDT_Balance || 0;
        let beforePairBal = userBalanceBefore?.[`${baseSymbol}_Balance`] || 0;

        if (findOrderData.type === "buy") {
            symbol = findOrderData.pairName.substring(3, 7);
            cancelAmount = parseFloat(findOrderData.pendingAmnt) * parseFloat(findOrderData.price);
        } else if (findOrderData.type === "sell") {
            symbol = findOrderData.pairName.substring(0, 3);
            cancelAmount = parseFloat(findOrderData.pendingAmnt);
        }

        await userUpdateBalance(findOrderData.userId, symbol, parseFloat(cancelAmount), "add");

        const userBalanceAfter = await updateBalance.findOne({ userId: findOrderData.userId });

        let afterUsdtBal = userBalanceAfter?.USDT_Balance || 0;
        let afterPairBal = userBalanceAfter?.[`${baseSymbol}_Balance`] || 0;

        const mappingData = {
            dateTime: new Date(),
            pair: findOrderData.pair,
            pairName: findOrderData.pairName,
            tradePrice: findOrderData.price,
            filledAmount: findOrderData.pendingAmnt,
            total: parseFloat(findOrderData.price) * parseFloat(findOrderData.pendingAmnt),
            orderType: findOrderData.orderType,
            orderState: findOrderData.type,
            role: findOrderData.feeStatus,
            status: "cancelled",
            beforeUsdtBal,
            afterUsdtBal,
            beforePairBal,
            afterPairBal
        };


        if (findOrderData.type === "buy") {
            mappingData.buyOrderId = findOrderData._id;
            mappingData.buyerUserId = findOrderData.userId;
            mappingData.buyPrice = findOrderData.price;
        } else {
            mappingData.sellOrderId = findOrderData._id;
            mappingData.sellerUserId = findOrderData.userId;
            mappingData.sellPrice = findOrderData.price;

        }

        await MappingOrders.create(mappingData);

        if (findOrderData.status == "partially") {
            let totalAmount = findOrderData.price * findOrderData.pendingAmnt;
            const cancelledOrder = {
                userId: findOrderData.userId,
                amount: findOrderData.pendingAmnt,
                filledAmount: 0,
                pendingAmnt: findOrderData.pendingAmnt,
                price: findOrderData.price,
                usdPrice: findOrderData.usdPrice,
                totalUsdPrice: findOrderData.totalUsdPrice,
                type: findOrderData.type,
                total: totalAmount,
                beforeUsdtBal: findOrderData.beforeUsdtBal,
                beforePairBal: findOrderData.beforePairBal,
                creditAmount: findOrderData.filledAmount,
                fee: 0,
                feeStatus: "",
                orderType: findOrderData.orderType,
                dateTime: new Date(),
                pair: findOrderData.pair,
                pairName: findOrderData.pairName,
                status: 'partially cancelled',
                referenceId: new mongoose.Types.ObjectId(),
                isProcessed: false,
                isProcessing: false,
                updateAt: new Date(),
            };

            await TradeOrderHistory.create(cancelledOrder);
        }



        const updatedOrder = await Order.findOneAndUpdate(
            { _id: findOrderData._id },
            { $set: { status: findOrderData.amount === findOrderData.pendingAmnt ? "cancelled" : "filled", updateAt: new Date(), } },
            { new: true }
        );
        if (updatedOrder) {
            // console.log("cancel successfully>>>>>>>>>>>>>>>>>>>>>>>>")
            return { status: true, message: "Your order has been cancelled and the amount has been credited to your wallet", orderId: updatedOrder._id };
        } else {
            // console.log("failed during cancel>>>>>>>>>>>>>>>")
            return { status: false, message: "Cannot cancel the order" };
        }
    } catch (error) {
        console.error("Error in Cancel Order:", error);
        return { status: false, message: "Internal server error" };
    }
};
