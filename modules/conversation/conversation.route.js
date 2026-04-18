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

router.post("/pin", authMiddleware, ConversationController.pinMessage);

router.delete("/pin", authMiddleware, ConversationController.unpinMessage);

router.get(
  "/pinned/:conversationId",
  authMiddleware,
  ConversationController.getPinnedMessages,
);

module.exports = router;
