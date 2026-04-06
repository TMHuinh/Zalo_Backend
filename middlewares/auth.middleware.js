const jwt = require("jsonwebtoken");

const authMiddleware = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        message: "Thiếu token",
      });
    }

    // format: Bearer token
    const token = authHeader.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        message: "Token không hợp lệ",
      });
    }

    // verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // lưu userId vào request
    req.userId = decoded.userId;

    next();
  } catch (err) {
    return res.status(401).json({
      message: "Token hết hạn hoặc không hợp lệ",
    });
  }
};

module.exports = authMiddleware;