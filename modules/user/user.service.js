const bcrypt = require("bcryptjs");
const User = require("../../models/user.model");
const { AppError } = require("../../utils/AppError");
const mongoose = require("mongoose");

const UserService = {
  register: async (fullName, phone, password) => {
    // 1. check user tồn tại
    const existingUser = await User.findOne({ phone });

    if (existingUser) {
      throw AppError(400, "Số điện thoại đã tồn tại", 1400);
    }

    // 2. hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // 3. tạo user
    const newUser = await User.create({
      fullName,
      phone,
      passwordHash,
      status: "active",
      isOnline: false,
      createdAt: new Date(),
    });
    // 4. return data (không trả password)
    return {
      id: newUser._id,
      fullName: newUser.fullName,
      phone: newUser.phone,
    };
  },
  // GET ALL USERS
  getAllUsers: async () => {
    const users = await User.find().select("-passwordHash"); // loại bỏ password

    return users;
  },

  // GET USER BY ID
  getUserById: async (id) => {

    // 1. kiểm tra id hợp lệ
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw AppError(400, "ID không hợp lệ", 1400);
    }

    // 2. tìm user
    const user = await User.findById(id).select("-passwordHash -refreshToken");


    if (!user) {
      throw AppError(404, "Không tìm thấy user", 1404);
    }

    // 3. return
    return user;
  },
};

module.exports = { UserService };
