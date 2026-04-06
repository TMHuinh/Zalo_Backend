const { ApiResponse } = require("../../utils/response");
const { AuthService } = require("./auth.service");

const AuthController = {
  login: async (req, res, next) => {
    try {
      const { phone, password } = req.body;

      const result = await AuthService.login({ phone, password });

      // set refresh token vào cookie
      res.cookie("refreshToken", result.refreshToken, {
        httpOnly: true,
        secure: false, // production (HTTPS)
        sameSite: "Strict",
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 ngày
      });

      return res.status(200).json(
        ApiResponse(1000, {
          user: result.user,
          accessToken: result.accessToken,
        }),
      );
    } catch (err) {
      next(err);
    }
  },
  // LOGOUT
  // LOGOUT
  logout: async (req, res, next) => {
    try {
      const userId = req.userId; // từ middleware authMiddleware

      if (!userId) {
        return res.status(400).json(ApiResponse(1001, "User không tồn tại"));
      }

      // gọi service logout
      await AuthService.logout(userId);

      // xóa cookie refreshToken
      res.clearCookie("refreshToken", {
        httpOnly: true,
        secure: false,
        sameSite: "Strict",
      });

      return res.status(200).json(ApiResponse(1000, "Đăng xuất thành công"));
    } catch (err) {
      next(err);
    }
  },
};

module.exports = { AuthController };
