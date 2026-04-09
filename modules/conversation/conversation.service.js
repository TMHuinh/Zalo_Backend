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
};
module.exports = { ConversationService };
