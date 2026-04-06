const jwt = require("jsonwebtoken");

const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET;

const authMiddleware = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({ message: "Thiếu token" });
    }

    // format: Bearer <token>
    const token = authHeader.split(" ")[1];

    if (!token) {
      return res.status(401).json({ message: "Token không hợp lệ" });
    }

    // verify token với ACCESS_TOKEN_SECRET
    const decoded = jwt.verify(token, ACCESS_TOKEN_SECRET);

    // lưu userId vào request để controller dùng
    req.userId = decoded.userId;

    next();
  } catch (err) {
    console.error("JWT Error:", err); // debug token
    return res.status(401).json({ message: "Token hết hạn hoặc không hợp lệ" });
  }
};

module.exports = authMiddleware;