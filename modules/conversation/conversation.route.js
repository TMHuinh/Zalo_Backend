const express = require("express");
const router = express.Router();
const authMiddleware = require("../../middlewares/auth.middleware");
const { ConversationController } = require("./conversation.controller");
const upload = require("../../middlewares/upload.middleware");

router.get("/getByUserId", authMiddleware, ConversationController.getByUserId);
router.post(
  "/group",
  authMiddleware,
  ConversationController.createGroupConversation,
);
router.patch(
  "/group/:conversationId",
  authMiddleware,
  upload.single("avatar"),
  ConversationController.updateGroupInfo,
);
module.exports = router;
