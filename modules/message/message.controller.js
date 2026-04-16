const { ApiResponse } = require("../../utils/response");
const { MessageService } = require("./message.service");

const MessageController = {
  sendMessage: async (req, res, next) => {
    try {
      // Lấy thêm attachments từ body (dùng cho forward ảnh/file có sẵn URL)
      const { conversationId, content, type, replyToMessageId, senderId, attachments } = req.body;
      const files = req.files || [];
      
      const message = await MessageService.saveMessage({
        conversationId,
        senderId,
        type,
        content,
        replyToMessageId: replyToMessageId || null,
        files,
        attachments, // 👈 Truyền vào service
      });

      return res.status(201).json(ApiResponse(1000, message));
    } catch (error) {
      next(error);
    }
  },

  getMessagesByConversation: async (req, res, next) => {
    try {
      const { conversationId } = req.params;
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 20;

      const result = await MessageService.getMessagesByConversation({
        conversationId,
        page,
        limit,
      });

      return res.status(200).json(ApiResponse(1000, result));
    } catch (error) {
      next(error);
    }
  },

  deleteMessage: async (req, res, next) => {
    try {
      const { messageId } = req.body;
      const message = await MessageService.deleteMessage(messageId);
      const conversationId = message.conversationId?.toString();
      const io = req.app.get("io");
      
      if (conversationId && io) {
        io.to(conversationId).emit("message_updated", message);
      }
      return res.status(200).json(ApiResponse(1000, message));
    } catch (error) {
      next(error);
    }
  },

  revokeMessage: async (req, res, next) => {
    try {
      const { messageId } = req.body;
      const message = await MessageService.revokeMessage(messageId);
      const conversationId = message.conversationId?.toString();
      const io = req.app.get("io");

      if (conversationId && io) {
        io.to(conversationId).emit("message_updated", message);
      }
      return res.status(200).json(ApiResponse(1000, message));
    } catch (error) {
      next(error);
    }
  },
};

module.exports = { MessageController };