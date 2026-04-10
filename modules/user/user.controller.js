// const s3Service = require("../../services/s3.service");

const { ApiResponse } = require("../../utils/response");
const { UserService } = require("./user.service");
const upload = require("../../middlewares/upload.middleware");

// exports.uploadAvatar = async (req, res, next) => {
//   try {
//     const url = await s3Service.uploadFile(req.file);
//     res.json({ url });
//   } catch (err) {
//     next(err);
//   }
// };
const UserController = {
  register: async (req, res, next) => {
    try {
      const { fullName, email, password,phone } = req.body;
      const result = await UserService.register(fullName, email, password,phone);

      res.status(201).json({
        message: "Register success",
        result,
      });
    } catch (error) {
      next(error);
    }
  },
  forgetPassword: async (req, res, next) => {
    try {
      const { email } = req.body;
      const result = await UserService.forgetPassword(email);

      res.status(200).json({
        message: "Forgot password success",
        result,
      });
    } catch (error) {
      next(error);
    }
  },

  verifyEmailOtp: async (req, res, next) => {
    try {
      const { email, otp } = req.body;
      const result = await UserService.verifyEmailOtp(email, otp);

      res.status(200).json({
        message: "Verify success",
        result,
      });
    } catch (error) {
      next(error);
    }
  },

  resendEmailOtp: async (req, res, next) => {
    try {
      const { email } = req.body;
      const result = await UserService.resendEmailOtp(email);

      res.status(200).json({
        message: "Resend OTP success",
        result,
      });
    } catch (error) {
      next(error);
    }
  },
  getAll: async (req, res, next) => {
    try {
      const users = await UserService.getAllUsers();

      res.status(200).json({
        message: "Lấy danh sách user thành công",
        data: users,
      });
    } catch (error) {
      next(error);
    }
  },

  // GET BY ID
  getById: async (req, res, next) => {
    try {
      const { id } = req.params;

      const user = await UserService.getUserById(id);

      return res.json(
        ApiResponse(1000, {
          result: user,
        }),
      );
    } catch (err) {
      next(err);
    }
  },
  changePassword: async (req, res, next) => {
    try {
      const userId = req.userId; // ✅ lấy đúng từ middleware
      const { oldPassword, newPassword, confirmPassword } = req.body;
      // console.log("=== DEBUG CHANGE PASSWORD ===");
      // console.log("UserId từ middleware:", req.userId);
      // console.log("Body nhận được:", req.body);

      const result = await UserService.changePassword(
        userId,
        oldPassword,
        newPassword,
        confirmPassword,
      );

      return res.json(ApiResponse(1000, { result }));
    } catch (err) {
      next(err);
    }
  },
  searchByPhone: async (req, res, next) => {
    try {
      const { phone } = req.query;

      const user = await UserService.searchByPhone(phone);

      res.json({
        message: "Tìm thấy user",
        data: user,
      });
    } catch (err) {
      next(err);
    }
  },
};

UserController.uploadAvatar = [
  upload.single("avatar"),
  async (req, res, next) => {
    try {
      const userId = req.userId;
      const result = await UserService.updateAvatar(userId, req.file);
      res.status(200).json({ result });
    } catch (err) {
      console.error("Upload avatar backend error:", err);
      next(err);
    }
  },
];
module.exports = { UserController };
