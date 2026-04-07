const multer = require("multer");

// Lưu file tạm vào memory để dễ upload Cloudinary
const storage = multer.memoryStorage();
const upload = multer({ storage });

module.exports = upload;