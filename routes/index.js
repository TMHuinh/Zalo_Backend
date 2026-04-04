const express = require("express");
const router = express.Router();

router.get("/", (req, res) => {
  res.json({ message: "API running..." });
});

router.use("/auth", require("../modules/auth/auth.routes"));
router.use("/user", require("../modules/user/user.routes"));

module.exports = router;