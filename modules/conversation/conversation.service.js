const mongoose = require("mongoose");
const Conversation = require("../../models/conversation.model");
const User = require("../../models/user.model");
const buildAutoGroupName = (users, currentUserId) => {
  const otherUsers = users.filter(
    (user) => user._id.toString() !== currentUserId.toString(),
  );

  const names = otherUsers
    .map((user) => (user.fullName || "").trim())
    .filter((name) => name.length > 0);

  if (names.length === 0) {
    return "Nhóm mới";
  }

  const displayNames = names.slice(0, 3);
  let finalName = displayNames.join(", ");

  if (names.length > 3) {
    finalName += ", ...";
  }

  return finalName;
};
const AI_CONVERSATION_NAME = "Trợ lý AI";
const AI_AVATAR_URL =
  "https://media.istockphoto.com/id/2074604864/vi/vec-to/bi%E1%BB%83u-t%C6%B0%E1%BB%A3ng-khu%C3%B4n-m%E1%BA%B7t-robot-m%E1%BA%B7t-c%C6%B0%E1%BB%9Di-chatbot-v%E1%BB%9Bi-micr%C3%B4-v%C3%A0-bong-b%C3%B3ng-l%E1%BB%9Di-tho%E1%BA%A1i-minh-h%E1%BB%8Da-%C4%91%C6%B0%E1%BB%9Dng.jpg?s=612x612&w=0&k=20&c=u3EtyOj604q3kba1ynyvrxSTPhmAEex1FJFfcskoSI4=";
const BOT_USER_ID = process.env.CHATBOT_USER_ID;
const ConversationService = {
  getGroupConversationByUserId: async (userId) => {
    const conversations = await Conversation.find({
      type: "group",
      $or: [{ ownerId: userId }, { "members.userId": userId }],
      isDeleted: false,
    })
      .sort({ lastMessageAt: -1 })
      .populate("lastMessageId");

    return conversations;
  },

  getConversationByUserId: async (userId) => {
    const conversations = await Conversation.find({
      isDeleted: false,
      "members.userId": userId,
    })
      .sort({ lastMessageAt: -1 })
      .populate("lastMessageId")
      .populate("members.userId", "fullName avatarUrl");

    return conversations;
  },
  createGroupConversation: async ({
    currentUserId,
    name,
    avatarUrl = "",
    memberIds,
  }) => {
    if (!currentUserId) {
      const error = new Error("Bạn chưa đăng nhập");
      error.statusCode = 401;
      throw error;
    }

    if (!Array.isArray(memberIds)) {
      const error = new Error("memberIds phải là một mảng");
      error.statusCode = 400;
      throw error;
    }

    const normalizedCurrentUserId = currentUserId.toString();

    const cleanedMemberIds = memberIds
      .map((id) => id?.toString().trim())
      .filter((id) => id);

    const uniqueMemberIds = [...new Set(cleanedMemberIds)].filter(
      (id) => id !== normalizedCurrentUserId,
    );

    if (uniqueMemberIds.length < 2) {
      const error = new Error("Phải chọn ít nhất 2 người để tạo nhóm");
      error.statusCode = 400;
      throw error;
    }

    const allUserIds = [normalizedCurrentUserId, ...uniqueMemberIds];

    const hasInvalidObjectId = allUserIds.some(
      (id) => !mongoose.Types.ObjectId.isValid(id),
    );

    if (hasInvalidObjectId) {
      const error = new Error("Có userId không hợp lệ");
      error.statusCode = 400;
      throw error;
    }

    const users = await User.find({
      _id: { $in: allUserIds },
      isDeleted: { $ne: true },
    }).select("_id fullName avatarUrl isOnline");

    if (users.length !== allUserIds.length) {
      const error = new Error("Một hoặc nhiều thành viên không tồn tại");
      error.statusCode = 404;
      throw error;
    }

    let finalName = (name || "").toString().trim();

    if (!finalName) {
      finalName = buildAutoGroupName(users, normalizedCurrentUserId);
    }

    const members = [
      {
        userId: normalizedCurrentUserId,
        role: "owner",
      },
      ...uniqueMemberIds.map((id) => ({
        userId: id,
        role: "member",
      })),
    ];

    const conversation = await Conversation.create({
      type: "group",
      name: finalName,
      avatarUrl: avatarUrl?.toString().trim() || "",
      ownerId: normalizedCurrentUserId,
      members,
      lastMessageId: null,
      lastMessageAt: null,
      lastMessagePreview: "",
      isDeleted: false,
    });

    const populatedConversation = await Conversation.findById(conversation._id)
      .populate("ownerId", "_id fullName avatarUrl")
      .populate("members.userId", "_id fullName avatarUrl isOnline");

    return populatedConversation;
  },
  createOrGetAIConversation: async (userId) => {
    if (!userId) {
      throw new Error("Thiếu userId");
    }

    // Tìm conversation 1-1 giữa user và bot
    let conversation = await Conversation.findOne({
      type: "direct",
      isDeleted: false,
      isChatbot: true,
      "members.userId": { $all: [userId, BOT_USER_ID] },
    });

    if (conversation) {
      return conversation;
    }
    conversation = await Conversation.create({
      type: "direct",
      name: AI_CONVERSATION_NAME,
      avatarUrl: AI_AVATAR_URL,
      ownerId: userId,
      isDeleted: false,
      members: [
        {
          userId: new mongoose.Types.ObjectId(userId),
          role: "member",
          joinedAt: new Date(),
        },
        {
          userId: new mongoose.Types.ObjectId(BOT_USER_ID),
          role: "member",
          joinedAt: new Date(),
        },
      ],
      lastMessage: null,
      lastMessageAt: null,
    });

    return conversation;
  },
};
module.exports = { ConversationService };
