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
};
module.exports = { ConversationService };
