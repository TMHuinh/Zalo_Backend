const { ApiResponse } = require("../../utils/response");
const { ConversationService } = require("./conversation.service");

const ConversationController = {
  getByUserId: async (req, res, next) => {
    try {
      const userId = req.userId; // lấy từ authMiddleware

      const result = await ConversationService.getConversationByUserId(userId);

      res.json({
        code: 1000,
        message: "Get conversation successfully",
        result,
      });
    } catch (err) {
      next(err);
    }
  },
  createGroupConversation: async (req, res, next) => {
    try {
      const currentUserId = req.userId;
      const { name, avatarUrl, memberIds } = req.body;

      const conversation = await ConversationService.createGroupConversation({
        currentUserId,
        name,
        avatarUrl,
        memberIds,
      });

      return res.status(200).json({
        message: "Tạo nhóm thành công",
        data: conversation,
      });
    } catch (err) {
      next(err);
    }
  },

  pinMessage: async (req, res, next) => {
    try {
      const { conversationId, messageId } = req.body;
      const userId = req.userId;

      const result = await ConversationService.pinMessage({
        conversationId,
        messageId,
        userId,
      });

      return res.status(200).json(ApiResponse(1000, result));
    } catch (error) {
      next(error);
    }
  },

  unpinMessage: async (req, res, next) => {
    try {
      const { conversationId, messageId } = req.body;
      const userId = req.userId;

      const result = await ConversationService.unpinMessage({
        conversationId,
        messageId,
        userId,
      });

      return res.status(200).json(ApiResponse(1000, result));
    } catch (error) {
      next(error);
    }
  },

  getPinnedMessages: async (req, res, next) => {
    try {
      const { conversationId } = req.params;
      const result = await ConversationService.getPinnedMessages({ conversationId });

      return res.status(200).json(ApiResponse(1000, result));
    } catch (error) {
      next(error);
    }
  },
  updateGroupInfo: async (req, res, next) => {
    try {
      const currentUserId = req.userId;
      const { conversationId } = req.params;
      const { name, avatarUrl } = req.body;
      console.log(req.file);
      const conversation = await ConversationService.updateGroupInfo({
        currentUserId,
        conversationId,
        name,
        avatarUrl,
        file: req.file,
      });

      return res.status(200).json({
        code: 1000,
        message: "Cập nhật thông tin nhóm thành công",
        result: conversation,
      });
    } catch (err) {
      next(err);
    }
  },
};

module.exports = { ConversationController };
