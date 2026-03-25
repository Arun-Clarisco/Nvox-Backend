const createError = require('http-errors');
const express = require('express');
const cors = require("cors")
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const adminRouter = require('./routes/adminRoute');
const usersRouter = require('./routes/userRoute');
const app = express();
const socketCommon = require('./Controllers/socket/socketCommon')
const http = require('http');
const notificationHelper = require('./Controllers/userControllers/notificationSend')
const socketData = require("./Controllers/userControllers/trade");
const socketOpenOrder = require("./Controllers/userControllers/user_getMethods")
const userAuth = require("./Auth/userAuth");
const server = http.createServer(app);
require("./db");
require("./helper/cron.helper")
app.use(logger('dev'));
app.use(cors());
app.set("view engine", "jade");
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.set("view engine", "jade")
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));


const io = require("socket.io")(server, {
  pingTimeout: 6000000,
  pingInterval: 100000,
  cookie: false,
});

socketCommon.SocketInitial(io);
notificationHelper.SocketInit(io);
socketData.SocketInit(io);

io.on("connection", function (socket) {
  // console.log('Client connected');
  socket.setMaxListeners(20);

  socket.on("registerUser", (email) => {
    userAuth.userSocketMap.set(email, socket.id);
  });

  socket.on("LiveDataPrice", async (data) => {
    await socketData.fetchPairData(data)
  })

  socket.on("joinRoom", (userToken) => {
    if (userToken) {
      socket.join(userToken.toString());
      io.sockets.emit('joined', userToken);
    }
  });

  socket.on("createTrade", async (data) => {
    await socketData.createOrder(data, socket);
  });

  socket.on("MyTradeOrder", async (data) => {
    await socketOpenOrder.OpenOrderData(data, socket);
  });

  socket.on("recentTradeOrder", async (data) => {
    await socketOpenOrder.recentOrder(data, socket);
  });

  socket.on("userGetBalance", async (data) => {
    await socketOpenOrder.userGetBalance(data, socket)
  })


  socket.on("disconnect", () => {
    console.log("Client disconnected");
  });
})
require('./Controllers/socket/socketQuery').afterDbConnected()


app.use('/', usersRouter);
app.use('/admin', adminRouter);
// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});
// error handler
app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});
module.exports = { app, server };