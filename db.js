const mongoose = require("mongoose")
const Config = require('./Config/config')

const MONGODB_URI = Config.MongoCluster;
mongoose.connect(MONGODB_URI, ).then(() => {
  console.log('MongoDB connected');
}).catch((err) => {
  console.error('MongoDB connection error:', err);
});
