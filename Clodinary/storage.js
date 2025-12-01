const Cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const multer = require("multer");
const config = require("../Config/config");

Cloudinary.config({
    cloud_name: config.CLOUD_NAME,
    api_key: config.CLOUDINARY_APIKEY,
    api_secret: config.CLOUDINARY_SECRET
});
const CloudStorage = new CloudinaryStorage({
    cloudinary: Cloudinary,
    params: {
        folder: "Rempic",
        resource_type: 'auto',
    }
})
exports.uploads = multer({
    storage: CloudStorage,
    limits: {
        fileSize: 50 * 1024 * 1024 // ✅ 50MB in bytes
    }
})