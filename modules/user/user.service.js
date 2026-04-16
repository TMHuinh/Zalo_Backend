const bcrypt = require("bcryptjs");
const User = require("../../models/user.model");
const { AppError } = require("../../utils/AppError");
const mongoose = require("mongoose");
const { sendEmail } = require("../../services/mail.service");
const { uploadImage } = require("../../services/cloudinary.service");
const Friendship = require("../../models/friendship.model");
const { ConversationService } = require("../conversation/conversation.service");

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
    ConversationService.createOrGetAIConversation(newUser.id);
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
  updateStatus: (userId, status) => {
    return User.findByIdAndUpdate(userId, { isOnline: status }, { new: true });
  },
  forgetPassword: async (email) => {
    const user = await User.findOne({ email });

    if (!user) {
      throw AppError(404, "Không tìm thấy người dùng", 1404);
    }

    const otp = generateOtp();
    const otpExpires = new Date(Date.now() + 5 * 60 * 1000);

    user.emailOtp = otp;
    user.emailOtpExpires = otpExpires;
    await user.save();

    await sendEmail({
      to: email,
      subject: "Mã OTP khôi phục mật khẩu",
      html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6">
        <h2>Khôi phục mật khẩu</h2>
        <p>Xin chào <b>${user.fullName}</b>,</p>
        <p>Mã OTP để khôi phục mật khẩu của bạn là:</p>
        <h1 style="color: #0068ff; letter-spacing: 4px;">${otp}</h1>
        <p>Mã có hiệu lực trong <b>5 phút</b>.</p>
      </div>
    `,
    });

    return { message: "OTP khôi phục mật khẩu đã được gửi về email" };
  },
  verifyForgotPasswordOtp: async (email, otp) => {
    const user = await User.findOne({ email });

    if (!user) {
      throw AppError(404, "Không tìm thấy người dùng", 1404);
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

    const newPassword = generateRandomPassword(10);
    const salt = await bcrypt.genSalt(10);

    user.passwordHash = await bcrypt.hash(newPassword, salt);
    user.emailOtp = null;
    user.emailOtpExpires = null;

    await user.save();

    await sendEmail({
      to: email,
      subject: "Mật khẩu mới của bạn",
      html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6">
        <h2>Khôi phục mật khẩu thành công</h2>
        <p>Xin chào <b>${user.fullName}</b>,</p>
        <p>Đây là mật khẩu mới của bạn:</p>
        <h1 style="color: #0068ff; letter-spacing: 2px;">${newPassword}</h1>
        <p>Vui lòng đăng nhập và đổi lại mật khẩu ngay sau khi vào hệ thống.</p>
      </div>
    `,
    });

    return { message: "Mật khẩu mới đã được gửi về email" };
  },
  searchByPhone: async (phone, requesterId) => {
    if (!phone || !phone.trim()) {
      throw AppError(400, "Số điện thoại không được để trống", 1400);
    }

    const cleanPhone = phone.trim();

    const user = await User.findOne({ phone: cleanPhone }).select(
      "-passwordHash -refreshToken -emailOtp -emailOtpExpires",
    );

    if (!user) {
      throw AppError(404, "Không tìm thấy người dùng", 1404);
    }

    // self check (SAFE)
    const isMe = requesterId && user._id.toString() === requesterId.toString();

    if (isMe) {
      return {
        user,
        relationship: "self",
      };
    }

    // check friendship
    let relationship = "none";

    if (requesterId) {
      const friendship = await Friendship.findOne({
        $or: [
          { requesterId, addresseeId: user._id },
          { requesterId: user._id, addresseeId: requesterId },
        ],
      });

      if (friendship) {
        relationship = friendship.status;
      }
    }

    return {
      user,
      relationship,
    };
  },
  updateUser: async (userId, data) => {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw AppError(400, "ID không hợp lệ", 1400);
    }

    const user = await User.findById(userId);
    if (!user) {
      throw AppError(404, "Không tìm thấy user", 1404);
    }

    const { fullName, gender, bio, phone, dateOfBirth } = data;

    // validate fullName
    if (fullName !== undefined) {
      if (!fullName.trim()) {
        throw AppError(400, "Họ tên không được để trống", 1401);
      }
      user.fullName = fullName.trim();
    }

    // validate gender
    if (gender !== undefined) {
      const validGender = ["male", "female", "other"];
      if (!validGender.includes(gender)) {
        throw AppError(400, "Giới tính không hợp lệ", 1402);
      }
      user.gender = gender;
    }

    // bio
    if (bio !== undefined) {
      if (bio.length > 300) {
        throw AppError(400, "Bio tối đa 300 ký tự", 1403);
      }
      user.bio = bio;
    }

    // phone
    if (phone !== undefined) {
      user.phone = phone;
    }

    // dateOfBirth
    if (dateOfBirth !== undefined) {
      if (dateOfBirth === null || dateOfBirth === "") {
        user.dateOfBirth = null;
      } else {
        const date = new Date(dateOfBirth);
        if (isNaN(date.getTime())) {
          throw AppError(400, "Ngày sinh không hợp lệ", 1404);
        }
        user.dateOfBirth = date;
      }
    }

    await user.save();

    return {
      message: "Cập nhật thông tin thành công",
      user: {
        _id: user._id,
        fullName: user.fullName,
        gender: user.gender,
        bio: user.bio,
        phone: user.phone,
        dateOfBirth: user.dateOfBirth,
        avatarUrl: user.avatarUrl,
        isOnline: user.isOnline,
        updatedAt: user.updatedAt,
      },
    };
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
