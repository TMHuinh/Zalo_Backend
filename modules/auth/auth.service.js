import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import User from "../models/User.js";

const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET || "access_secret";
const REFRESH_TOKEN_SECRET =
  process.env.REFRESH_TOKEN_SECRET || "refresh_secret";

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
      throw new Error("Số điện thoại không tồn tại");
    }

    if (user.status && user.status !== "active") {
      throw new Error("Tài khoản đã bị khóa hoặc không hoạt động");
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);

    if (!isMatch) {
      throw new Error("Mật khẩu không đúng");
    }

    const accessToken = this.generateToken(user);
    const refreshToken = this.generateRefreshToken(user);

    await User.findByIdAndUpdate(user._id, {
      refreshToken,
      lastSeenAt: new Date(),
      isOnline: true,
    });

    return {
      user: {
        _id: user._id,
        fullName: user.fullName,
        phone: user.phone,
        avatarUrl: user.avatarUrl,
      },
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

export default AuthService;
