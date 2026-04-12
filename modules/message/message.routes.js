const express = require("express");
const router = express.Router();
const { MessageController } = require("./message.controller");
const { verifyToken } = require("../../middlewares/auth.middleware");
const upload = require("../../middlewares/upload.middleware");
const authMiddleware = require("../../middlewares/auth.middleware");

// gửi tin nhắn
router.post(
  "/send",
  authMiddleware,
  upload.array("files", 10),
  MessageController.sendMessage,
);

// lấy danh sách tin nhắn theo conversation
router.get(
  "/conversation/:conversationId",
  authMiddleware,
  MessageController.getMessagesByConversation,
);

router.delete("/delete", authMiddleware, MessageController.deleteMessage);
router.delete("/revoke", authMiddleware, MessageController.revokeMessage);

module.exports = router;
