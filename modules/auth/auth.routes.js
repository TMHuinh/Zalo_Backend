const express = require("express");
const { AuthController } = require("./auth.controller");
const router = express.Router();

router.get("/", (req, res) => {
  res.json({ message: "Auth API" });
});
router.post("/login", AuthController.login);
module.exports = router;
