const express = require("express");
const { AuthController } = require("./auth.controller");
const { verify } = require("jsonwebtoken");
const authMiddleware = require("../../middlewares/auth.middleware");
const router = express.Router();

router.get("/", (req, res) => {
  res.json({ message: "Auth API" });
});
router.post("/login", AuthController.login);
router.post("/logout", authMiddleware, AuthController.logout);
module.exports = router;
