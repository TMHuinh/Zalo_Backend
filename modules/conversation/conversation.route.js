const express = require("express");
const router = express.Router();
const authMiddleware = require("../../middlewares/auth.middleware");
const { ConversationController } = require("./conversation.controller");

router.get("/getByUserId", authMiddleware, ConversationController.getByUserId);
router.post(
  "/group",
  authMiddleware,
  ConversationController.createGroupConversation,
);
module.exports = router;
