const jwt = require('jsonwebtoken');
const userCollection = require('../Modules/userModule/userModule');
const config = require('../Config/config');

exports.verifyToken = async (req, res, next) => {
  try {
    const token = req.headers['authorization'];
    if (!token) {
      return res.send({ status: false, message: 'No token provided.' });
    }

    const bearerToken = token.split(" ")[1];

    jwt.verify(bearerToken, config.JWT_USER_SECRET, async (err, decoded) => {
      if (err) {
        return res.send({ status: false, message: 'Failed to authenticate token.' });
      }

      const user = await userCollection.findOne({ _id: decoded.id });

      if (!user) {
        return res.send({ status: false, message: 'User not found.' });
      }

      if (user.user_auth !== bearerToken) {
        return res.send({ status: false, message: 'Session invalidated. Please login again.' });
      }

      res.locals.user_id = user._id;
      next();
    });
  } catch (error) {
    console.log('verifyToken error:', error);
    return res.send({ status: false, message: 'Something went wrong..!' });
  }
};

exports.userSocketMap = new Map();

exports.activeSession = new Map();

exports.pendingSession = new Map();
