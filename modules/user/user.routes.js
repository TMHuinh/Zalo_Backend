const express = require("express");
const router = express.Router();
const upload = require("../../middlewares/upload.middleware");
const authMiddleware = require("../../middlewares/auth.middleware");
// const controller = require("./user.controller");
const { UserController } = require("./user.controller");
// router.post("/avatar", upload.single("file"), controller.uploadAvatar);
router.post("/register", UserController.register);
router.post("/verify-email", UserController.verifyEmailOtp);
router.post("/forgot-password", UserController.forgetPassword);
router.post("/resend-otp", UserController.resendEmailOtp);
// GET ALL USERS
router.get("/", UserController.getAll);
router.get("/:id", UserController.getById);
router.patch("/change-password", authMiddleware, UserController.changePassword);

module.exports = router;
