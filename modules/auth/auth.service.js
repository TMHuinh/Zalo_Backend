const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const User = require("../../models/user.model");
const { AppError } = require("../../utils/AppError");

const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET;
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET;

const AuthService = {
  generateToken: (user) => {
    return jwt.sign(
      {
        userId: user._id,
        phone: user.phone,
      },
      ACCESS_TOKEN_SECRET,
      { expiresIn: "15m" },
    );
  },

  generateRefreshToken: (user) => {
    return jwt.sign(
      {
        userId: user._id,
      },
      REFRESH_TOKEN_SECRET,
      { expiresIn: "7d" },
    );
  },

  verifyToken: (token) => {
    try {
      return jwt.verify(token, ACCESS_TOKEN_SECRET);
    } catch (error) {
      return null;
    }
  },

  verifyRefreshToken: (token) => {
    try {
      return jwt.verify(token, REFRESH_TOKEN_SECRET);
    } catch (error) {
      return null;
    }
  },

  login: async ({ phone, password }) => {
    const user = await User.findOne({ phone });

    if (!user) {
      throw AppError(404, "Số điện thoại không tồn tại", 1404);
    }

    if (user.status && user.status !== "active") {
      throw AppError(400, "Tài khoản bị khóa hoặc không hoạt động", 1400);
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);

    if (!isMatch) {
      throw AppError(400, "Mật khẩu không chính xác", 1400);
    }

    const accessToken = AuthService.generateToken(user);
    const refreshToken = AuthService.generateRefreshToken(user);

    await User.findByIdAndUpdate(user._id, {
      refreshToken,
      lastSeenAt: new Date(),
      isOnline: true,
    });

    return {
      accessToken,
      refreshToken,
    };
  },

  logout: async (userId) => {
    await User.findByIdAndUpdate(userId, {
      refreshToken: null,
      isOnline: false,
      lastSeenAt: new Date(),
    });

    return {
      message: "Đăng xuất thành công",
    };
  },
};

module.exports = { AuthService };
