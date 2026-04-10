const mongoose = require("mongoose");
const Message = require("../../models/message.model");
const Conversation = require("../../models/conversation.model");
const { AppError } = require("../../utils/AppError");
const { uploadAttachment } = require("../../services/cloudinary.service");

const normalizeMessageType = (content, attachments) => {
  if (attachments.length > 0) {
    const uniqueTypes = [...new Set(attachments.map((item) => item.type))];

    if (uniqueTypes.length === 1) {
      return uniqueTypes[0];
    }

    return "file";
  }

  return content?.trim() ? "text" : "text";
};

const MessageService = {
  saveMessage: async ({
    conversationId,
    senderId,
    content = "",
    replyToMessageId = null,
    files = [],
  }) => {
    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
      throw AppError(400, "conversationId không hợp lệ", 1400);
    }

    if (!mongoose.Types.ObjectId.isValid(senderId)) {
      throw AppError(400, "senderId không hợp lệ", 1400);
    }

    if (
      replyToMessageId &&
      !mongoose.Types.ObjectId.isValid(replyToMessageId)
    ) {
      throw AppError(400, "replyToMessageId không hợp lệ", 1400);
    }

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      throw AppError(404, "Không tìm thấy cuộc trò chuyện", 1404);
    }

    const isMember = conversation.members.some(
      (member) => member.userId.toString() === senderId.toString(),
    );

    if (!isMember) {
      throw AppError(403, "Bạn không thuộc cuộc trò chuyện này", 1403);
    }

    if (replyToMessageId) {
      const repliedMessage = await Message.findById(replyToMessageId);
      if (!repliedMessage) {
        throw AppError(404, "Tin nhắn reply không tồn tại");
      }

      if (
        repliedMessage.conversationId.toString() !== conversationId.toString()
      ) {
        throw AppError(
          400,
          "Tin nhắn reply không thuộc cuộc trò chuyện này",
          1400,
        );
      }
    }

    let attachments = [];

    if (files && files.length > 0) {
      const uploadResults = await Promise.all(
        files.map(async (file) => {
          return await uploadAttachment(file);
        }),
      );

      attachments = uploadResults.map((item) => ({
        type: item.type,
        url: item.url,
        fileName: item.fileName || "",
        mimeType: item.mimeType || "",
        size: item.size || 0,
        duration: item.duration || 0,
        width: item.width || null,
        height: item.height || null,
      }));
    }

    if (!content?.trim() && attachments.length === 0) {
      throw AppError(400, "Tin nhắn không được để trống", 1400);
    }

    const messageType = normalizeMessageType(content, attachments);

    const newMessage = await Message.create({
      conversationId,
      senderId,
      type: messageType,
      content: content?.trim() || "",
      attachments,
      replyToMessageId,
      seenBy: [
        {
          userId: senderId,
          seenAt: new Date(),
        },
      ],
    });

    conversation.lastMessageId = newMessage._id;
    await conversation.save();

    return await Message.findById(newMessage._id)
      .populate("senderId", "fullName avatarUrl")
      .populate("replyToMessageId");
  },
  getMessagesByConversation: async ({
    conversationId,
    page = 1,
    limit = 20,
  }) => {
    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
      throw new AppError(400, "conversationId không hợp lệ", 1400);
    }

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      throw new AppError(404, "Không tìm thấy cuộc trò chuyện", 1404);
    }

    const skip = (page - 1) * limit;

    const [messages, total] = await Promise.all([
      Message.find({ conversationId })
        .populate("senderId", "fullName avatarUrl")
        .populate("replyToMessageId")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Message.countDocuments({ conversationId }),
    ]);

    return {
      data: messages,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },
};

module.exports = { MessageService };
