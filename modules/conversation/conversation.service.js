const Conversation = require("../../models/conversation.model");

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
};
module.exports = { ConversationService };
