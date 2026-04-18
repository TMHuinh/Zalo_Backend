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
