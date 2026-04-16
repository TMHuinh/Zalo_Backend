const mongoose = require("mongoose");
const Message = require("../../models/message.model");
const Conversation = require("../../models/conversation.model");
const { AppError } = require("../../utils/AppError");
const { uploadAttachment } = require("../../services/cloudinary.service");

const normalizeMessageType = (content, attachments) => {
  if (attachments && attachments.length > 0) {
    const uniqueTypes = [...new Set(attachments.map((item) => item.type))];
    if (uniqueTypes.length === 1) {
      return uniqueTypes[0];
    }
    return "file";
  }
  return "text";
};

const ALLOWED_TYPES = ["text", "image", "video", "file", "audio", "system", "sticker"];

const MessageService = {
  saveMessage: async ({
    conversationId,
    senderId,
    type = null,
    content = "",
    replyToMessageId = null,
    files = [],
    attachments: forwardedAttachments = [], // 👈 forward attachments
  }) => {
    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
      throw AppError(400, "conversationId không hợp lệ");
    }

    if (!mongoose.Types.ObjectId.isValid(senderId)) {
      throw AppError(400, "senderId không hợp lệ");
    }

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      throw AppError(404, "Không tìm thấy cuộc trò chuyện");
    }

    const isMember = conversation.members.some(
      (member) => member.userId.toString() === senderId.toString(),
    );

    if (!isMember) {
      throw AppError(403, "Bạn không thuộc cuộc trò chuyện này");
    }

    let attachments = [];

    // Ưu tiên 1: Nếu có files mới gửi lên -> Upload lên Cloudinary
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
    // Ưu tiên 2: Nếu không có files nhưng có attachments gửi kèm (Forward)
    else if (forwardedAttachments && forwardedAttachments.length > 0) {
      attachments =
        typeof forwardedAttachments === "string"
          ? JSON.parse(forwardedAttachments)
          : forwardedAttachments;
    }

    // ---- NEW: quyết định type ----
    let messageType;

    // Nếu FE có gửi type -> verify rồi dùng luôn
    if (type != null && type !== "") {
      if (!ALLOWED_TYPES.includes(type)) {
        throw AppError(400, "type không hợp lệ");
      }
      messageType = type;
    } else {
      // Không gửi type -> giữ logic cũ
      messageType = normalizeMessageType(content, attachments);
    }

    // ---- NEW: validate theo type (chỉ khi FE gửi type) ----
    // (Nếu không gửi type thì giữ hành vi cũ: chỉ cần content hoặc attachments)
    if (type != null && type !== "") {
      if ((messageType === "text") && !content?.trim()) {
        throw AppError(400, "Tin nhắn text không được để trống");
      }

      if ((messageType === "sticker") && !content?.trim()) {
        throw AppError(400, "Sticker không được để trống");
      }

      // file/image mà lại không có attachments sau khi upload/forward -> lỗi
      if ((messageType === "file" || messageType === "image") && attachments.length === 0) {
        throw AppError(400, "Tin nhắn file/image phải có files hoặc attachments");
      }
    } else {
      // validate cũ
      if (!content?.trim() && attachments.length === 0) {
        throw AppError(400, "Tin nhắn không được để trống");
      }
    }

    const newMessage = await Message.create({
      conversationId,
      senderId,
      type: messageType,
      content: content?.trim() || "",
      attachments,
      replyToMessageId: replyToMessageId || null,
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

  getMessagesByConversation: async ({ conversationId, page = 1, limit = 20 }) => {
    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
      throw new AppError(400, "conversationId không hợp lệ");
    }

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      throw new AppError(404, "Không tìm thấy cuộc trò chuyện");
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

  deleteMessage: async (messageId) => {
    return await Message.findByIdAndUpdate(
      messageId,
      { $set: { isDeleted: true } },
      { new: true },
    );
  },

  revokeMessage: async (messageId) => {
    return await Message.findByIdAndUpdate(
      messageId,
      { $set: { isRecalled: true } },
      { new: true },
    );
  },
};

module.exports = { MessageService };