const express = require("express");
const router = express.Router();
const upload = require("../../middlewares/upload.middleware");
// const controller = require("./user.controller");
const { UserController } = require("./user.controller");
// router.post("/avatar", upload.single("file"), controller.uploadAvatar);
router.post("/register", UserController.register);
module.exports = router;
