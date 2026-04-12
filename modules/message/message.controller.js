const { ApiResponse } = require("../../utils/response");
const { MessageService } = require("./message.service");

const MessageController = {
  sendMessage: async (req, res, next) => {
    try {
      const { conversationId, content, replyToMessageId, senderId } = req.body;
      const files = req.files || [];
      const message = await MessageService.saveMessage({
        conversationId,
        senderId,
        content,
        replyToMessageId: replyToMessageId || null,
        files,
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
      console.log("IO:", req.app.get("io"));
      if (conversationId) {
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
      console.log(conversationId);
      const io = req.app.get("io");

      if (conversationId) {
        io.to(conversationId).emit("message_updated", message);
      }
      return res.status(200).json(ApiResponse(1000, message));
    } catch (error) {
      next(error);
    }
  },
};

module.exports = { MessageController };
