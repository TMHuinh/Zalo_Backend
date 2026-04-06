// const s3Service = require("../../services/s3.service");

const { ApiResponse } = require("../../utils/response");
const { UserService } = require("./user.service");

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
      const { fullName, phone, password } = req.body;
      const result = await UserService.register(fullName, phone, password);
      return res.status(200).json(
        ApiResponse(1000, {
          result,
        }),
      );
    } catch (error) {
      next(error);
    }
  },
};
module.exports = { UserController };
