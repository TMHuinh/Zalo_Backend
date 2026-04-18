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

router.post("/pin", authMiddleware, ConversationController.pinMessage);

router.delete("/pin", authMiddleware, ConversationController.unpinMessage);

router.get(
  "/pinned/:conversationId",
  authMiddleware,
  ConversationController.getPinnedMessages,
);

router.patch(
  "/group/:conversationId",
  authMiddleware,
  upload.single("avatar"),
  ConversationController.updateGroupInfo,
);
router.delete(
  "/:conversationId/clear",
  authMiddleware,
  ConversationController.deleteConversation
);
module.exports = router;
