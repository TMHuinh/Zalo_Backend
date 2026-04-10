const bcrypt = require("bcryptjs");
const User = require("../../models/user.model");
const { AppError } = require("../../utils/AppError");
const mongoose = require("mongoose");
const { sendEmail } = require("../../services/mail.service");
const { uploadImage } = require("../../services/cloudinary.service");

const generateOtp = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};
const generateRandomPassword = (length = 10) => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789@#$";
  let password = "";

  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return password;
};

const UserService = {
  register: async (fullName, email, password, phone) => {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      throw AppError(400, "Email đã tồn tại", 1400);
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const otp = generateOtp();
    const otpExpires = new Date(Date.now() + 5 * 60 * 1000); // 5 phút

    const newUser = await User.create({
      fullName,
      email,
      passwordHash,
      phone,
      status: "active",
      isOnline: false,
      emailOtp: otp,
      emailOtpExpires: otpExpires,
      createdAt: new Date(),
    });

    await sendEmail({
      to: email,
      subject: "Mã OTP xác thực email",
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6">
          <h2>Xác thực tài khoản</h2>
          <p>Xin chào <b>${fullName}</b>,</p>
          <p>Mã OTP của bạn là:</p>
          <h1 style="color: #0068ff; letter-spacing: 4px;">${otp}</h1>
          <p>Mã có hiệu lực trong <b>5 phút</b>.</p>
        </div>
      `,
    });
    return {
      id: newUser._id,
      fullName: newUser.fullName,
      email: newUser.email,
      phone: newUser.phone,
      message: "Đăng ký thành công, vui lòng kiểm tra email để lấy OTP",
    };
  },

  verifyEmailOtp: async (email, otp) => {
    const user = await User.findOne({ email });

    if (!user) {
      throw AppError(404, "Không tìm thấy người dùng", 1404);
    }

    if (user.isVerified) {
      throw AppError(400, "Email đã được xác thực", 1401);
    }

    if (!user.emailOtp || !user.emailOtpExpires) {
      throw AppError(400, "OTP không tồn tại", 1402);
    }

    if (user.emailOtp !== otp) {
      throw AppError(400, "OTP không đúng", 1403);
    }

    if (user.emailOtpExpires < new Date()) {
      throw AppError(400, "OTP đã hết hạn", 1405);
    }

    user.isVerified = true;
    user.emailOtp = null;
    user.emailOtpExpires = null;

    await user.save();

    return { message: "Xác thực email thành công" };
  },

  resendEmailOtp: async (email) => {
    const user = await User.findOne({ email });

    if (!user) {
      throw AppError(404, "Không tìm thấy người dùng", 1404);
    }

    if (user.isVerified) {
      throw AppError(400, "Email đã được xác thực", 1401);
    }

    const otp = generateOtp();
    const otpExpires = new Date(Date.now() + 5 * 60 * 1000);

    user.emailOtp = otp;
    user.emailOtpExpires = otpExpires;
    await user.save();

    await sendEmail({
      to: email,
      subject: "Mã OTP xác thực email",
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6">
          <h2>Gửi lại mã OTP</h2>
          <p>Mã OTP mới của bạn là:</p>
          <h1 style="color: #0068ff; letter-spacing: 4px;">${otp}</h1>
          <p>Mã có hiệu lực trong <b>5 phút</b>.</p>
        </div>
      `,
    });

    return { message: "Đã gửi lại OTP về email" };
  },

  getAllUsers: async () => {
    const users = await User.find().select("-passwordHash");
    return users;
  },

  getUserById: async (id) => {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw AppError(400, "ID không hợp lệ", 1400);
    }

    const user = await User.findById(id).select("-passwordHash -refreshToken");

    if (!user) {
      throw AppError(404, "Không tìm thấy user", 1404);
    }

    return user;
  },

  changePassword: async (userId, oldPassword, newPassword, confirmPassword) => {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw AppError(400, "ID không hợp lệ", 1400);
    }

    const user = await User.findById(userId);
    if (!user) {
      throw AppError(404, "Không tìm thấy user", 1404);
    }

    if (newPassword !== confirmPassword) {
      throw AppError(400, "Mật khẩu mới không trùng nhau", 1401);
    }

    const isMatch = await bcrypt.compare(oldPassword, user.passwordHash);
    if (!isMatch) {
      throw AppError(400, "Mật khẩu cũ không đúng", 1402);
    }

    const salt = await bcrypt.genSalt(10);
    user.passwordHash = await bcrypt.hash(newPassword, salt);

    await user.save();

    return { message: "Đổi mật khẩu thành công" };
  },
  updateStatus: async (userId, status) => {
    return await User.findByIdAndUpdate(
      userId,
      [
        {
          $set: {
            status: status,
          },
        },
      ],
      { new: true },
    );
  },
  forgetPassword: async (email) => {
    const user = await User.findOne({ email });

    if (!user) {
      throw AppError(404, "Không tìm thấy người dùng", 1404);
    }

    const newPassword = generateRandomPassword(10);

    const salt = await bcrypt.genSalt(10);
    user.passwordHash = await bcrypt.hash(newPassword, salt);

    await user.save();

    await sendEmail({
      to: email,
      subject: "Mật khẩu mới của bạn",
      html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6">
        <h2>Khôi phục mật khẩu</h2>
        <p>Xin chào <b>${user.fullName}</b>,</p>
        <p>Hệ thống đã tạo cho bạn một mật khẩu mới:</p>
        <h1 style="color: #0068ff; letter-spacing: 2px;">${newPassword}</h1>
        <p>Vui lòng đăng nhập và đổi lại mật khẩu ngay sau khi vào hệ thống.</p>
      </div>
    `,
    });

    return { message: "Mật khẩu mới đã được gửi về email" };
  },
  searchByPhone: async (phone) => {
    if (!phone) {
      throw AppError(400, "Số điện thoại không được để trống", 1400);
    }

    const user = await User.findOne({ phone }).select(
      "-passwordHash -refreshToken -emailOtp -emailOtpExpires",
    );

    if (!user) {
      throw AppError(404, "Không tìm thấy người dùng", 1404);
    }

    return user;
  },
};

UserService.updateAvatar = async (userId, file) => {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw AppError(400, "ID không hợp lệ", 1400);
  }

  const user = await User.findById(userId);
  if (!user) throw AppError(404, "Không tìm thấy user", 1404);

  if (!file) throw AppError(400, "Chưa chọn file", 1400);

  // Upload file lên Cloudinary từ buffer
  const avatarUrl = await uploadImage(file.buffer, file.originalname); // sửa lại uploadImage nhận buffer

  user.avatarUrl = avatarUrl;
  await user.save();

  return { message: "Cập nhật avatar thành công", avatarUrl };
};

module.exports = { UserService };
