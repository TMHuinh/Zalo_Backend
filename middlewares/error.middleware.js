module.exports = (err, req, res, next) => {
  res.status(err.status || 500).json({
    message: err.message || "Có lỗi từ server",
    code: err.code || 1500,
  });
};
