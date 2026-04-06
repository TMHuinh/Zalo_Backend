const express = require("express");
const router = express.Router();
const upload = require("../../middlewares/upload.middleware");
const authMiddleware = require("../../middlewares/auth.middleware")
// const controller = require("./user.controller");
const { UserController } = require("./user.controller");
// router.post("/avatar", upload.single("file"), controller.uploadAvatar);
router.post("/register", UserController.register);
// GET ALL USERS
router.get("/", UserController.getAll);

// GET USER BY ID
router.get("/:id", UserController.getById);

module.exports = router;
