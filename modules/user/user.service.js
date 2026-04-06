const bcrypt = require("bcryptjs");
const User = require("../../models/user.model");
const { AppError } = require("../../utils/AppError");

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
};

module.exports = { UserService };
