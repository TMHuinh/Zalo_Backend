const express = require("express");
const router = express.Router();

router.get("/", (req, res) => {
  res.json({ message: "API running..." });
});

router.use("/auth", require("../modules/auth/auth.routes"));
router.use("/user", require("../modules/user/user.routes"));
router.use("/friendship", require("../modules/friendship/friendship.routes"));
router.use("/message", require("../modules/message/message.routes"));
router.use("/conversation", require("../modules/conversation/conversation.route"));
module.exports = router;
