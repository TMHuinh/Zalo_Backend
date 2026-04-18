const mongoose = require("mongoose");
const Message = require("../../models/message.model");
const Conversation = require("../../models/conversation.model");
const { AppError } = require("../../utils/AppError");
const { uploadAttachment } = require("../../services/cloudinary.service");

const ALLOWED_TYPES = [
  "text",
  "image",
  "video",
  "file",
  "audio",
  "system",
  "sticker",
  "mixed",
];

const ALLOWED_ATTACHMENT_TYPES = ["image", "video", "file", "audio"];

const parseJsonIfString = (value, fallback = []) => {
  if (!value) return fallback;
  if (Array.isArray(value)) return value;

  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }

  return fallback;
};

const normalizeAttachment = (item) => {
  if (!item || typeof item !== "object") return null;
  if (!item.url || typeof item.url !== "string") return null;

  return {
    type: ALLOWED_ATTACHMENT_TYPES.includes(item.type) ? item.type : "file",
    url: item.url,
    fileName: item.fileName || "",
    mimeType: item.mimeType || "",
    size: Number(item.size) || 0,
    duration: Number(item.duration) || 0,
    width: item.width ?? null,
    height: item.height ?? null,
  };
};

const normalizeAttachments = (items = []) => {
  if (!Array.isArray(items)) return [];
  return items.map(normalizeAttachment).filter(Boolean);
};

const inferMessageType = ({ explicitType, content, attachments }) => {
  if (explicitType) return explicitType;

  const hasContent = !!content?.trim();
  const hasAttachments = attachments.length > 0;

  if (!hasAttachments) return "text";
  if (hasContent) return "mixed";

  const uniqueTypes = [...new Set(attachments.map((item) => item.type))];
  if (uniqueTypes.length === 1) return uniqueTypes[0];

  return "file";
};

const validateMessage = ({ type, content, attachments }) => {
  const hasContent = !!content?.trim();
  const hasAttachments = attachments.length > 0;

  if (!ALLOWED_TYPES.includes(type)) {
    throw AppError(400, "type không hợp lệ");
  }

  if (!hasContent && !hasAttachments) {
    throw AppError(400, "Tin nhắn không được để trống");
  }

  if (type === "text" && !hasContent) {
    throw AppError(400, "Tin nhắn text không được để trống");
  }

  if (type === "sticker" && !hasContent) {
    throw AppError(400, "Sticker không được để trống");
  }

  if (["image", "video", "audio", "file"].includes(type) && !hasAttachments) {
    throw AppError(400, `Tin nhắn ${type} phải có attachments`);
  }

  if (type === "mixed" && (!hasContent || !hasAttachments)) {
    throw AppError(400, "Tin nhắn mixed phải có cả content và attachments");
  }
};

const escapeRegex = (value = "") => {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

const ensureConversationAndMember = async ({ conversationId, userId }) => {
  if (!mongoose.Types.ObjectId.isValid(conversationId)) {
    throw AppError(400, "conversationId không hợp lệ");
  }

  if (userId && !mongoose.Types.ObjectId.isValid(userId)) {
    throw AppError(400, "userId không hợp lệ");
  }

  const conversation = await Conversation.findById(conversationId);
  if (!conversation) {
    throw AppError(404, "Không tìm thấy cuộc trò chuyện");
  }

  if (userId) {
    const isMember = conversation.members.some(
      (member) => member.userId.toString() === userId.toString(),
    );

    if (!isMember) {
      throw AppError(403, "Bạn không thuộc cuộc trò chuyện này");
    }
  }

  return conversation;
};

const MessageService = {
  saveMessage: async ({
    conversationId,
    senderId,
    type = null,
    content = "",
    replyToMessageId = null,
    files = [],
    attachments: rawAttachments = [],
    isForwarded,
  }) => {
    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
      throw AppError(400, "conversationId không hợp lệ");
    }

    if (!mongoose.Types.ObjectId.isValid(senderId)) {
      throw AppError(400, "senderId không hợp lệ");
    }

    if (
      replyToMessageId &&
      !mongoose.Types.ObjectId.isValid(replyToMessageId)
    ) {
      throw AppError(400, "replyToMessageId không hợp lệ");
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

    if (Array.isArray(files) && files.length > 0) {
      const uploadResults = await Promise.all(
        files.map((file) => uploadAttachment(file)),
      );

      attachments = normalizeAttachments(
        uploadResults.map((item) => ({
          type: item.type,
          url: item.url,
          fileName: item.fileName,
          mimeType: item.mimeType,
          size: item.size,
          duration: item.duration,
          width: item.width,
          height: item.height,
        })),
      );
    } else {
      attachments = normalizeAttachments(parseJsonIfString(rawAttachments, []));
    }

    const trimmedContent = content?.trim() || "";

    const finalType = inferMessageType({
      explicitType: type,
      content: trimmedContent,
      attachments,
    });

    validateMessage({
      type: finalType,
      content: trimmedContent,
      attachments,
    });

    const newMessage = await Message.create({
      conversationId,
      senderId,
      type: finalType,
      content: trimmedContent,
      attachments,
      replyToMessageId: replyToMessageId || null,
      seenBy: [
        {
          userId: senderId,
          seenAt: new Date(),
        },
      ],
      isForwarded,
    });

    conversation.lastMessageId = newMessage._id;
    await conversation.save();

    return await Message.findById(newMessage._id)
      .populate("senderId", "fullName avatarUrl isBot")
      .populate({
        path: "replyToMessageId",
        populate: {
          path: "senderId",
          select: "fullName avatarUrl isBot",
        },
      });
  },

  saveChatbotMessage: async ({
    conversationId,
    chatbotSenderId,
    content = "",
    attachments = [],
    replyToMessageId = null,
  }) => {
    return await MessageService.saveMessage({
      conversationId,
      senderId: chatbotSenderId,
      content,
      attachments,
      replyToMessageId,
    });
  },

  getMessagesByConversation: async ({
    conversationId,
    page = 1,
    limit = 20,
  }) => {
    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
      throw AppError(400, "conversationId không hợp lệ");
    }

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      throw AppError(404, "Không tìm thấy cuộc trò chuyện");
    }

    const skip = (page - 1) * limit;

    const [messages, total] = await Promise.all([
      Message.find({ conversationId, isDeleted: false })
        .populate("senderId", "fullName avatarUrl isBot")
        .populate("reactions.userId", "fullName avatarUrl")
        .populate({
          path: "replyToMessageId",
          populate: {
            path: "senderId",
            select: "fullName avatarUrl isBot",
          },
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Message.countDocuments({ conversationId, isDeleted: false }),
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

  searchMessagesInConversation: async ({
    conversationId,
    userId,
    keyword,
    page = 1,
    limit = 20,
  }) => {
    await ensureConversationAndMember({ conversationId, userId });

    const trimmedKeyword = keyword?.trim();
    if (!trimmedKeyword) {
      throw AppError(400, "keyword không được để trống");
    }

    const skip = (page - 1) * limit;
    const regex = new RegExp(escapeRegex(trimmedKeyword), "i");

    const query = {
      conversationId,
      isDeleted: false,
      isRecalled: false,
      $or: [{ content: regex }, { "attachments.fileName": regex }],
    };

    const [messages, total] = await Promise.all([
      Message.find(query)
        .populate("senderId", "fullName avatarUrl isBot")
        .populate("reactions.userId", "fullName avatarUrl")
        .populate({
          path: "replyToMessageId",
          populate: {
            path: "senderId",
            select: "fullName avatarUrl isBot",
          },
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Message.countDocuments(query),
    ]);

    return {
      keyword: trimmedKeyword,
      data: messages,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  getConversationMedia: async ({
    conversationId,
    userId,
    mediaType = "all",
    page = 1,
    limit = 30,
  }) => {
    await ensureConversationAndMember({ conversationId, userId });

    const skip = (page - 1) * limit;

    const allowedMediaTypes = ["all", "image", "video", "file", "audio"];
    if (!allowedMediaTypes.includes(mediaType)) {
      throw AppError(400, "mediaType không hợp lệ");
    }

    const matchCondition = {
      conversationId: new mongoose.Types.ObjectId(conversationId),
      isDeleted: false,
      isRecalled: false,
      attachments: { $exists: true, $ne: [] },
    };

    const attachmentTypeCondition =
      mediaType === "all" ? {} : { "attachments.type": mediaType };

    const pipeline = [
      {
        $match: {
          ...matchCondition,
          ...attachmentTypeCondition,
        },
      },
      {
        $unwind: "$attachments",
      },
      ...(mediaType === "all"
        ? []
        : [
            {
              $match: {
                "attachments.type": mediaType,
              },
            },
          ]),
      {
        $sort: {
          createdAt: -1,
        },
      },
      {
        $facet: {
          items: [
            { $skip: skip },
            { $limit: limit },
            {
              $lookup: {
                from: "users",
                localField: "senderId",
                foreignField: "_id",
                as: "sender",
              },
            },
            {
              $unwind: {
                path: "$sender",
                preserveNullAndEmptyArrays: true,
              },
            },
            {
              $project: {
                _id: 1,
                conversationId: 1,
                messageType: "$type",
                content: 1,
                createdAt: 1,
                sender: {
                  _id: "$sender._id",
                  fullName: "$sender.fullName",
                  avatarUrl: "$sender.avatarUrl",
                  isBot: "$sender.isBot",
                },
                attachment: "$attachments",
              },
            },
          ],
          totalCount: [{ $count: "count" }],
        },
      },
    ];

    const result = await Message.aggregate(pipeline);

    const items = result?.[0]?.items || [];
    const total = result?.[0]?.totalCount?.[0]?.count || 0;

    return {
      filter: mediaType,
      data: items,
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
  reactMessage: async ({ messageId, userId, emoji }) => {
    if (!mongoose.Types.ObjectId.isValid(messageId)) {
      throw AppError(400, "messageId không hợp lệ");
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw AppError(400, "userId không hợp lệ");
    }

    if (!emoji || typeof emoji !== "string" || !emoji.trim()) {
      throw AppError(400, "emoji không hợp lệ");
    }

    const message = await Message.findById(messageId);
    if (!message) {
      throw AppError(404, "Không tìm thấy tin nhắn");
    }

    const conversation = await Conversation.findById(message.conversationId);
    if (!conversation) {
      throw AppError(404, "Không tìm thấy cuộc trò chuyện");
    }

    const isMember = conversation.members.some(
      (member) => member.userId.toString() === userId.toString(),
    );

    if (!isMember) {
      throw AppError(403, "Bạn không thuộc cuộc trò chuyện này");
    }

    const normalizedEmoji = emoji.trim();
    const reactionIndex = message.reactions.findIndex(
      (item) => item.userId.toString() === userId.toString(),
    );

    if (reactionIndex === -1) {
      message.reactions.push({
        userId,
        emoji: normalizedEmoji,
      });
    } else {
      const currentReaction = message.reactions[reactionIndex];

      if (currentReaction.emoji === normalizedEmoji) {
        message.reactions.splice(reactionIndex, 1);
      } else {
        message.reactions[reactionIndex].emoji = normalizedEmoji;
      }
    }

    await message.save();

    return await Message.findById(message._id)
      .populate("senderId", "fullName avatarUrl isBot")
      .populate("reactions.userId", "fullName avatarUrl")
      .populate({
        path: "replyToMessageId",
        populate: {
          path: "senderId",
          select: "fullName avatarUrl isBot",
        },
      });
  },
};

module.exports = { MessageService };
