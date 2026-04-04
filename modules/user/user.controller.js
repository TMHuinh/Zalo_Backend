const s3Service = require("../../services/s3.service");

exports.uploadAvatar = async (req, res, next) => {
  try {
    const url = await s3Service.uploadFile(req.file);
    res.json({ url });
  } catch (err) {
    next(err);
  }
};