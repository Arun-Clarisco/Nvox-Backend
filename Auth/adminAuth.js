const jwt = require('jsonwebtoken');
const adminCollection = require('../Modules/adminModule/AdminModule');
const config = require('../Config/config');

exports.verifyToken = async(req, res, next) => {
  const token = req.headers['authorization'];

  if (!token) {
    return res.send({ status: false, message: 'No token provided' });
  }
  const bearer = token.split(" ");
  const bearerToken = bearer[1];
  jwt.verify(bearerToken, config.JWT_ADMIN_SECRET, async (err, decoded) => {
    if (err) {
      return res.send({ status: false, message: 'Failed to authenticate token' });
    }
    let adminStatus = await adminCollection.findOne({ _id: decoded.id })
     //return res.send({status :  true, adminStatus}); 
    if (adminStatus) {
      res.locals.admin_id = adminStatus._id; 
      //res.send({status : true, data: adminStatus}); 
      next(); 
      
    } else {
      return res.send({ status: false, message: 'session expired' });
    }  
   
  });
}

