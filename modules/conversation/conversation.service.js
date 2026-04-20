const mongoose = require("mongoose");
const Conversation = require("../../models/conversation.model");
const Message = require("../../models/message.model");
const User = require("../../models/user.model");
const { uploadImage } = require("../../services/cloudinary.service");
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
    // 1. Tìm tất cả cuộc trò chuyện mà user là thành viên
    const conversations = await Conversation.find({
      isDeleted: false,
      "members.userId": userId,
    })
      .sort({ lastMessageAt: -1 }) // Sắp xếp theo tin nhắn mới nhất
      .populate("lastMessageId")
      .populate("members.userId", "_id fullName avatarUrl");

    // 2. Lọc danh sách trước khi trả về cho Frontend
    return conversations.filter((conv) => {
      const currentMember = conv.members.find(
        (m) => m.userId._id.toString() === userId.toString(),
      );

      if (!currentMember) return false;

      // 1. Chưa xóa thì hiện luôn
      if (!currentMember.deletedAt) return true;

      // 2. Nếu đã xóa, kiểm tra tin nhắn cuối cùng
      if (!conv.lastMessageAt) return false;

      // CHUYỂN VỀ SỐ (TIMESTAMP) ĐỂ SO SÁNH CHÍNH XÁC
      const lastMsgTime = new Date(conv.lastMessageAt).getTime();
      const deletedTime = new Date(currentMember.deletedAt).getTime();

      // Chỉ hiện lại nếu có tin nhắn mới sau thời điểm xóa
      return lastMsgTime > deletedTime;
    });
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
      type: "bot",
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

  pinMessage: async ({ conversationId, messageId, userId }) => {
    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
      throw AppError(400, "conversationId không hợp lệ");
    }

    if (!mongoose.Types.ObjectId.isValid(messageId)) {
      throw AppError(400, "messageId không hợp lệ");
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw AppError(400, "userId không hợp lệ");
    }

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      throw AppError(404, "Không tìm thấy cuộc trò chuyện");
    }

    const isMember = conversation.members.some(
      (member) => member.userId.toString() === userId.toString(),
    );

    if (!isMember) {
      throw AppError(403, "Bạn không thuộc cuộc trò chuyện này");
    }

    const message = await Message.findOne({
      _id: messageId,
      conversationId,
    });

    if (!message) {
      throw AppError(404, "Không tìm thấy tin nhắn trong cuộc trò chuyện");
    }

    const existed = conversation.pinnedMessages.some(
      (item) => item.messageId.toString() === messageId.toString(),
    );

    if (!existed) {
      conversation.pinnedMessages.push({
        messageId,
        pinnedBy: userId,
        pinnedAt: new Date(),
      });
      await conversation.save();
    }

    return await Conversation.findById(conversationId)
      .populate({
        path: "pinnedMessages.messageId",
        populate: [
          {
            path: "senderId",
            select: "fullName avatarUrl isBot",
          },
          {
            path: "replyToMessageId",
            populate: {
              path: "senderId",
              select: "fullName avatarUrl isBot",
            },
          },
          {
            path: "reactions.userId",
            select: "fullName avatarUrl",
          },
        ],
      })
      .populate("pinnedMessages.pinnedBy", "fullName avatarUrl");
  },

  unpinMessage: async ({ conversationId, messageId, userId }) => {
    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
      throw AppError(400, "conversationId không hợp lệ");
    }

    if (!mongoose.Types.ObjectId.isValid(messageId)) {
      throw AppError(400, "messageId không hợp lệ");
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw AppError(400, "userId không hợp lệ");
    }

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      throw AppError(404, "Không tìm thấy cuộc trò chuyện");
    }

    const isMember = conversation.members.some(
      (member) => member.userId.toString() === userId.toString(),
    );

    if (!isMember) {
      throw AppError(403, "Bạn không thuộc cuộc trò chuyện này");
    }

    conversation.pinnedMessages = conversation.pinnedMessages.filter(
      (item) => item.messageId.toString() !== messageId.toString(),
    );

    await conversation.save();

    return await Conversation.findById(conversationId)
      .populate({
        path: "pinnedMessages.messageId",
        populate: [
          {
            path: "senderId",
            select: "fullName avatarUrl isBot",
          },
          {
            path: "replyToMessageId",
            populate: {
              path: "senderId",
              select: "fullName avatarUrl isBot",
            },
          },
          {
            path: "reactions.userId",
            select: "fullName avatarUrl",
          },
        ],
      })
      .populate("pinnedMessages.pinnedBy", "fullName avatarUrl");
  },

  getPinnedMessages: async ({ conversationId }) => {
    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
      throw AppError(400, "conversationId không hợp lệ");
    }

    const conversation = await Conversation.findById(conversationId)
      .populate({
        path: "pinnedMessages.messageId",
        populate: [
          {
            path: "senderId",
            select: "fullName avatarUrl isBot",
          },
          {
            path: "replyToMessageId",
            populate: {
              path: "senderId",
              select: "fullName avatarUrl isBot",
            },
          },
          {
            path: "reactions.userId",
            select: "fullName avatarUrl",
          },
        ],
      })
      .populate("pinnedMessages.pinnedBy", "fullName avatarUrl");

    if (!conversation) {
      throw AppError(404, "Không tìm thấy cuộc trò chuyện");
    }

    return conversation.pinnedMessages.sort(
      (a, b) => new Date(b.pinnedAt) - new Date(a.pinnedAt),
    );
  },
  updateGroupInfo: async ({
    currentUserId,
    conversationId,
    name,
    avatarUrl,
    file,
  }) => {
    if (!currentUserId) {
      const error = new Error("Bạn chưa đăng nhập");
      error.statusCode = 401;
      throw error;
    }

    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
      const error = new Error("conversationId không hợp lệ");
      error.statusCode = 400;
      throw error;
    }

    const conversation = await Conversation.findOne({
      _id: conversationId,
      type: "group",
      isDeleted: false,
    });

    if (!conversation) {
      const error = new Error("Không tìm thấy nhóm");
      error.statusCode = 404;
      throw error;
    }

    const member = conversation.members.find(
      (m) => m.userId.toString() === currentUserId.toString(),
    );

    if (!member) {
      const error = new Error("Bạn không thuộc nhóm này");
      error.statusCode = 403;
      throw error;
    }

    // if (!["owner", "admin"].includes(member.role)) {
    //   const error = new Error("Bạn không có quyền chỉnh sửa thông tin nhóm");
    //   error.statusCode = 403;
    //   throw error;
    // }

    const updateData = {};
    const hasName = typeof name === "string";
    const hasAvatarUrl = typeof avatarUrl === "string";
    const hasFile = !!file;

    if (!hasName && !hasAvatarUrl && !hasFile) {
      const error = new Error("Phải truyền name hoặc avatar nhóm để cập nhật");
      error.statusCode = 400;
      throw error;
    }

    if (hasName) {
      const trimmedName = name.trim();
      if (!trimmedName) {
        const error = new Error("Tên nhóm không được để trống");
        error.statusCode = 400;
        throw error;
      }
      updateData.name = trimmedName;
    }

    if (hasFile) {
      // if (!file.mimetype?.startsWith("image/")) {
      //   const error = new Error("File avatar phải là ảnh");
      //   error.statusCode = 400;
      //   throw error;
      // }

      const fileName = `group_${conversationId}_${Date.now()}`;
      const uploadedUrl = await uploadImage(file.buffer, fileName);
      updateData.avatarUrl = uploadedUrl;
    } else if (hasAvatarUrl) {
      updateData.avatarUrl = avatarUrl.trim();
    }

    const updatedConversation = await Conversation.findByIdAndUpdate(
      conversationId,
      { $set: updateData },
      { new: true },
    )
      .populate("ownerId", "_id fullName avatarUrl")
      .populate("members.userId", "_id fullName avatarUrl isOnline")
      .populate("lastMessageId");

    return updatedConversation;
  },
  deleteConversationForUser: async ({ conversationId, userId }) => {
    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
      throw new Error("conversationId không hợp lệ");
    }

    const conversation = await Conversation.findOneAndUpdate(
      {
        _id: conversationId,
        "members.userId": userId,
      },
      {
        $set: { "members.$.deletedAt": new Date() },
      },
      { new: true },
    );

    if (!conversation) {
      throw new Error(
        "Không tìm thấy cuộc trò chuyện hoặc bạn không phải thành viên",
      );
    }

    return conversation;
  },
  getGroupMembers: async ({ conversationId, currentUserId }) => {
    if (!currentUserId) {
      const error = new Error("Bạn chưa đăng nhập");
      error.statusCode = 401;
      throw error;
    }

    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
      const error = new Error("conversationId không hợp lệ");
      error.statusCode = 400;
      throw error;
    }

    const conversation = await Conversation.findOne({
      _id: conversationId,
      type: "group",
      isDeleted: false,
    }).populate("members.userId", "_id fullName avatarUrl");

    if (!conversation) {
      const error = new Error("Không tìm thấy nhóm");
      error.statusCode = 404;
      throw error;
    }

    const isMember = conversation.members.some(
      (member) => member.userId?._id?.toString() === currentUserId.toString(),
    );

    if (!isMember) {
      const error = new Error("Bạn không thuộc nhóm này");
      error.statusCode = 403;
      throw error;
    }

    return conversation.members.map((member) => ({
      id: member.userId?._id?.toString() ?? "",
      fullName: member.userId?.fullName ?? "",
      avatarUrl: member.userId?.avatarUrl ?? "",
      role: member.role ?? "member",
    }));
  },
  removeMemberFromGroup: async ({
    currentUserId,
    conversationId,
    memberId,
  }) => {
    if (!currentUserId) {
      const error = new Error("Bạn chưa đăng nhập");
      error.statusCode = 401;
      throw error;
    }

    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
      const error = new Error("conversationId không hợp lệ");
      error.statusCode = 400;
      throw error;
    }

    if (!mongoose.Types.ObjectId.isValid(memberId)) {
      const error = new Error("memberId không hợp lệ");
      error.statusCode = 400;
      throw error;
    }

    const conversation = await Conversation.findOne({
      _id: conversationId,
      type: "group",
      isDeleted: false,
    });

    if (!conversation) {
      const error = new Error("Không tìm thấy nhóm");
      error.statusCode = 404;
      throw error;
    }

    const currentMember = conversation.members.find(
      (m) => m.userId.toString() === currentUserId.toString(),
    );

    if (!currentMember) {
      const error = new Error("Bạn không thuộc nhóm này");
      error.statusCode = 403;
      throw error;
    }

    // Chỉ trưởng nhóm mới được xóa thành viên
    if (currentMember.role !== "owner") {
      const error = new Error("Chỉ trưởng nhóm mới có quyền xóa thành viên");
      error.statusCode = 403;
      throw error;
    }

    if (memberId.toString() === currentUserId.toString()) {
      const error = new Error(
        "Không thể tự xóa chính mình khỏi nhóm bằng chức năng này",
      );
      error.statusCode = 400;
      throw error;
    }

    const targetMember = conversation.members.find(
      (m) => m.userId.toString() === memberId.toString(),
    );

    if (!targetMember) {
      const error = new Error("Không tìm thấy thành viên trong nhóm");
      error.statusCode = 404;
      throw error;
    }

    if (targetMember.role === "owner") {
      const error = new Error("Không thể xóa trưởng nhóm");
      error.statusCode = 400;
      throw error;
    }

    conversation.members = conversation.members.filter(
      (m) => m.userId.toString() !== memberId.toString(),
    );

    await conversation.save();

    const updatedConversation = await Conversation.findById(conversationId)
      .populate("ownerId", "_id fullName avatarUrl")
      .populate("members.userId", "_id fullName avatarUrl isOnline")
      .populate("lastMessageId");

    return updatedConversation;
  },
  assignGroupOwner: async ({ currentUserId, conversationId, memberId }) => {
    if (!currentUserId) {
      const error = new Error("Bạn chưa đăng nhập");
      error.statusCode = 401;
      throw error;
    }

    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
      const error = new Error("conversationId không hợp lệ");
      error.statusCode = 400;
      throw error;
    }

    if (!mongoose.Types.ObjectId.isValid(memberId)) {
      const error = new Error("memberId không hợp lệ");
      error.statusCode = 400;
      throw error;
    }

    const conversation = await Conversation.findOne({
      _id: conversationId,
      type: "group",
      isDeleted: false,
    });

    if (!conversation) {
      const error = new Error("Không tìm thấy nhóm");
      error.statusCode = 404;
      throw error;
    }

    const currentMember = conversation.members.find(
      (m) => m.userId.toString() === currentUserId.toString(),
    );

    if (!currentMember) {
      const error = new Error("Bạn không thuộc nhóm này");
      error.statusCode = 403;
      throw error;
    }

    if (currentMember.role !== "owner") {
      const error = new Error(
        "Chỉ trưởng nhóm mới có quyền bổ nhiệm trưởng nhóm",
      );
      error.statusCode = 403;
      throw error;
    }

    const targetMember = conversation.members.find(
      (m) => m.userId.toString() === memberId.toString(),
    );

    if (!targetMember) {
      const error = new Error("Không tìm thấy thành viên trong nhóm");
      error.statusCode = 404;
      throw error;
    }

    if (targetMember.userId.toString() === currentUserId.toString()) {
      const error = new Error("Bạn đang là trưởng nhóm");
      error.statusCode = 400;
      throw error;
    }

    const oldOwnerMember = conversation.members.find(
      (m) => m.userId.toString() === currentUserId.toString(),
    );

    if (!oldOwnerMember) {
      const error = new Error("Không tìm thấy trưởng nhóm hiện tại");
      error.statusCode = 404;
      throw error;
    }

    // Đổi role
    oldOwnerMember.role = "member";
    targetMember.role = "owner";

    // Đổi ownerId
    conversation.ownerId = targetMember.userId;

    await conversation.save();

    const updatedConversation = await Conversation.findById(conversationId)
      .populate("ownerId", "_id fullName avatarUrl")
      .populate("members.userId", "_id fullName avatarUrl isOnline")
      .populate("lastMessageId");

    return updatedConversation;
  },
  disbandGroup: async ({ currentUserId, conversationId }) => {
    const conversation = await Conversation.findOne({
      _id: conversationId,
      type: "group",
      isDeleted: false,
    });

    if (!conversation) {
      const error = new Error("Không tìm thấy nhóm hoặc nhóm đã bị giải tán");
      error.statusCode = 404;
      throw error;
    }

    // Chỉ trưởng nhóm (ownerId) mới có quyền giải tán
    if (conversation.ownerId.toString() !== currentUserId.toString()) {
      const error = new Error("Chỉ trưởng nhóm mới có quyền giải tán nhóm");
      error.statusCode = 403;
      throw error;
    }

    // Đánh dấu xóa vĩnh viễn cuộc hội thoại
    conversation.isDeleted = true;
    await conversation.save();

    return { conversationId };
  },
  addMembersToGroup: async ({ currentUserId, conversationId, memberIds }) => {
    const conversation = await Conversation.findOne({
      _id: conversationId,
      type: "group",
      isDeleted: false,
    });
    if (!conversation) throw new Error("Không tìm thấy nhóm");

    // Kiểm tra người thực hiện có trong nhóm không
    const isMember = conversation.members.some(
      (m) => m.userId.toString() === currentUserId.toString(),
    );
    if (!isMember)
      throw new Error("Bạn không có quyền thêm thành viên vào nhóm này");

    // Lọc ra các ID thực sự mới (chưa có trong nhóm)
    const existingMemberIds = conversation.members.map((m) =>
      m.userId.toString(),
    );
    const newMemberIds = memberIds.filter(
      (id) => !existingMemberIds.includes(id.toString()),
    );

    if (newMemberIds.length === 0) return conversation;

    // Kiểm tra các User ID mới có hợp lệ không
    const users = await User.find({
      _id: { $in: newMemberIds },
      isDeleted: { $ne: true },
    });
    if (users.length !== newMemberIds.length)
      throw new Error("Một số người dùng không tồn tại");

    // Thêm vào mảng members
    const newMembers = newMemberIds.map((id) => ({
      userId: id,
      role: "member",
      joinedAt: new Date(),
    }));
    conversation.members.push(...newMembers);

    await conversation.save();

    return await Conversation.findById(conversationId)
      .populate("ownerId", "_id fullName avatarUrl")
      .populate("members.userId", "_id fullName avatarUrl isOnline");
  },
  leaveGroup: async ({ currentUserId, conversationId }) => {
    if (!currentUserId) {
      const error = new Error("Bạn chưa đăng nhập");
      error.statusCode = 401;
      throw error;
    }

    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
      const error = new Error("conversationId không hợp lệ");
      error.statusCode = 400;
      throw error;
    }

    const conversation = await Conversation.findOne({
      _id: conversationId,
      type: "group",
      isDeleted: false,
    });

    if (!conversation) {
      const error = new Error("Không tìm thấy nhóm");
      error.statusCode = 404;
      throw error;
    }

    const currentMemberIndex = conversation.members.findIndex(
      (m) => m.userId.toString() === currentUserId.toString(),
    );

    if (currentMemberIndex === -1) {
      const error = new Error("Bạn không thuộc nhóm này");
      error.statusCode = 403;
      throw error;
    }

    const currentMember = conversation.members[currentMemberIndex];

    // Trưởng nhóm không được tự rời nếu nhóm vẫn còn người khác
    if (currentMember.role === "owner") {
      if (conversation.members.length === 1) {
        conversation.members = [];
        conversation.ownerId = null;
        conversation.isDeleted = true;
        await conversation.save();

        return {
          conversationId,
          leftUserId: currentUserId,
          isDisbanded: true,
        };
      }

      const error = new Error(
        "Bạn là trưởng nhóm. Hãy bổ nhiệm trưởng nhóm mới hoặc giải tán nhóm trước khi rời nhóm",
      );
      error.statusCode = 400;
      throw error;
    }

    conversation.members.splice(currentMemberIndex, 1);

    if (conversation.members.length === 0) {
      conversation.isDeleted = true;
    }

    await conversation.save();

    const updatedConversation = await Conversation.findById(conversationId)
      .populate("ownerId", "_id fullName avatarUrl")
      .populate("members.userId", "_id fullName avatarUrl isOnline")
      .populate("lastMessageId");

    return {
      conversationId,
      leftUserId: currentUserId,
      conversation: updatedConversation,
    };
  },
};
module.exports = { ConversationService };
