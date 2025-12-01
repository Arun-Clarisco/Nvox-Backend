const multer = require('multer');

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, "uploads");
    },
    filename: function (req, file, cb) {
      cb(null, Date.now() + "-" + file.originalname);
    },
  });
  

  const upload = multer({
    storage: storage,
    limits: {
      fileSize: 50 * 1024 * 1024, 
    },
    fileFilter: function (req, file, cb) {
      if (
        file.mimetype.startsWith("text/csv") ||
        file.mimetype.startsWith("application/pdf") ||
        file.mimetype.startsWith('image/')
      ) {
        const allowedExtensions = [".csv"];
        const ext = "." + file.originalname.split(".").pop().toLowerCase();
        if (allowedExtensions.includes(ext)) {
          cb(null, true);
        } else {
          cb(new Error("Invalid file extension. Only CSV files are allowed."));
        }
      } else {
        cb(new Error("Invalid file type. Only CSV  documents are allowed."));
      }
    },
  });

  module.exports = upload