const { ApiResponse } = require("../../utils/response");
const { ConversationService } = require("./conversation.service");
const { MessageService } = require("../message/message.service");
const User = require("../../models/user.model");

const ConversationController = {
  getByUserId: async (req, res, next) => {
    try {
      const userId = req.userId;
      const result = await ConversationService.getConversationByUserId(userId);
      res.json({
        code: 1000,
        message: "Get conversation successfully",
        result,
      });
    } catch (err) {
      next(err);
    }
  },

  createGroupConversation: async (req, res, next) => {
    try {
      const currentUserId = req.userId;
      const { name, avatarUrl, memberIds } = req.body;
      const conversation = await ConversationService.createGroupConversation({
        currentUserId,
        name,
        avatarUrl,
        memberIds,
      });
      const currentUser = await User.findById(currentUserId);
      const io = req.app.get("io");

      const systemMessage = await MessageService.saveMessage({
        conversationId: conversation._id,
        senderId: currentUserId,
        type: "system",
        content: `${currentUser.fullName} đã tạo nhóm "${conversation.name}"`,
      });

      // FIX: Gắn trực tiếp tin nhắn mới vào object trả về
      const convData = conversation.toObject
        ? conversation.toObject()
        : conversation;
      convData.lastMessageId = systemMessage;

      const allMembers = [currentUserId, ...memberIds];
      for (const userId of allMembers) {
        await io.in(userId.toString()).socketsJoin(conversation._id.toString());
        if (userId.toString() !== currentUserId.toString()) {
          io.to(userId.toString()).emit("new_conversation", convData);
        }
      }
      io.to(conversation._id.toString()).emit("new_message", systemMessage);

      return res
        .status(200)
        .json({ message: "Tạo nhóm thành công", data: convData });
    } catch (err) {
      next(err);
    }
  },

  updateGroupInfo: async (req, res, next) => {
    try {
      const currentUserId = req.userId;
      const { conversationId } = req.params;
      const { name, avatarUrl } = req.body;
      const currentUser = await User.findById(currentUserId);
      const conversation = await ConversationService.updateGroupInfo({
        currentUserId,
        conversationId,
        name,
        avatarUrl,
        file: req.file,
      });
      const io = req.app.get("io");

      const hasAvatarChange = !!req.file || !!avatarUrl;
      let content = `${currentUser.fullName} đã cập nhật thông tin nhóm`;
      if (name && hasAvatarChange)
        content = `${currentUser.fullName} đã đổi tên nhóm thành "${name}" và thay đổi ảnh đại diện`;
      else if (name)
        content = `${currentUser.fullName} đã đổi tên nhóm thành "${name}"`;
      else if (hasAvatarChange)
        content = `${currentUser.fullName} đã thay đổi ảnh đại diện nhóm`;

      const systemMessage = await MessageService.saveMessage({
        conversationId,
        senderId: currentUserId,
        type: "system",
        content,
      });

      // FIX: Đồng bộ dữ liệu
      const convData = conversation.toObject
        ? conversation.toObject()
        : conversation;
      convData.lastMessageId = systemMessage;

      io.to(conversationId.toString()).emit("group_updated", convData);
      io.to(conversationId.toString()).emit("new_message", systemMessage);

      return res.status(200).json({
        code: 1000,
        message: "Cập nhật thành công",
        result: convData,
      });
    } catch (err) {
      next(err);
    }
  },

  addMembersToGroup: async (req, res, next) => {
    try {
      const { conversationId } = req.params;
      const { memberIds } = req.body;
      const currentUserId = req.userId;

      const currentUser = await User.findById(currentUserId);
      const addedUsers = await User.find({ _id: { $in: memberIds } });

      const conversation = await ConversationService.addMembersToGroup({
        currentUserId,
        conversationId,
        memberIds,
      });

      const io = req.app.get("io");
      const addedNames = addedUsers.map((u) => u.fullName).join(", ");

      const systemMessage = await MessageService.saveMessage({
        conversationId,
        senderId: currentUserId,
        type: "system",
        content: `${currentUser.fullName} đã thêm ${addedNames} vào nhóm`,
      });

      // FIX: Gắn trực tiếp lastMessageId vào conversation để Admin không bị ghi đè UI
      const convData = conversation.toObject
        ? conversation.toObject()
        : conversation;
      convData.lastMessageId = systemMessage;

      for (const user of addedUsers) {
        const userId = user._id.toString();
        await io.in(userId).socketsJoin(conversationId.toString());
        io.to(userId).emit("new_conversation", convData);
      }

      io.to(conversationId.toString()).emit("group_updated", convData);
      io.to(conversationId.toString()).emit("new_message", systemMessage);

      return res.status(200).json({
        code: 1000,
        message: "Thêm thành viên thành công",
        result: convData,
      });
    } catch (err) {
      next(err);
    }
  },

  removeMemberFromGroup: async (req, res, next) => {
    try {
      const { conversationId, memberId } = req.params;
      const currentUserId = req.userId;
      const currentUser = await User.findById(currentUserId);
      const removedUser = await User.findById(memberId);

      const systemMessage = await MessageService.saveMessage({
        conversationId,
        senderId: currentUserId,
        type: "system",
        content: `${currentUser.fullName} xóa ${removedUser.fullName} ra khỏi nhóm`,
      });
      const conversation = await ConversationService.removeMemberFromGroup({
        currentUserId,
        conversationId,
        memberId,
      });

      const io = req.app.get("io");
      await io.in(memberId.toString()).socketsLeave(conversationId.toString());
      io.to(memberId.toString()).emit("removed_from_group", {
        conversationId,
        message: "Bạn đã bị xóa khỏi nhóm",
      });

      io.to(conversationId.toString()).emit("group_updated", conversation);
      io.to(conversationId.toString()).emit("new_message", systemMessage);

      return res
        .status(200)
        .json({ code: 1000, message: "Thành công", result: conversation });
    } catch (error) {
      next(error);
    }
  },

  leaveGroup: async (req, res, next) => {
    try {
      const { conversationId } = req.params;
      const currentUserId = req.userId;
      const currentUser = await User.findById(currentUserId);
      const io = req.app.get("io");

      const systemMessage = await MessageService.saveMessage({
        conversationId,
        senderId: currentUserId,
        type: "system",
        content: `${currentUser.fullName} đã rời nhóm`,
      });
      const result = await ConversationService.leaveGroup({
        currentUserId,
        conversationId,
      });

      await io
        .in(currentUserId.toString())
        .socketsLeave(conversationId.toString());
      if (result.isDisbanded) {
        io.to(conversationId.toString()).emit("group_disbanded", {
          conversationId,
          message: "Nhóm đã được giải tán",
        });
      } else {
        io.to(conversationId.toString()).emit(
          "group_updated",
          result.conversation,
        );
        io.to(conversationId.toString()).emit("new_message", systemMessage);
      }
      return res
        .status(200)
        .json({ code: 1000, message: "Rời nhóm thành công", result });
    } catch (error) {
      next(error);
    }
  },

  assignGroupOwner: async (req, res, next) => {
    try {
      const { conversationId } = req.params;
      const { memberId } = req.body;
      const currentUserId = req.userId;
      const currentUser = await User.findById(currentUserId);
      const targetUser = await User.findById(memberId);

      const conversation = await ConversationService.assignGroupOwner({
        currentUserId,
        conversationId,
        memberId,
      });
      const io = req.app.get("io");
      const systemMessage = await MessageService.saveMessage({
        conversationId,
        senderId: currentUserId,
        type: "system",
        content: `${currentUser.fullName} đã nhường quyền Trưởng nhóm cho ${targetUser.fullName}`,
      });

      const convData = conversation.toObject
        ? conversation.toObject()
        : conversation;
      convData.lastMessageId = systemMessage;

      io.to(conversationId.toString()).emit("group_updated", convData);
      io.to(conversationId.toString()).emit("new_message", systemMessage);

      return res.status(200).json({
        code: 1000,
        message: "Bổ nhiệm thành công",
        result: convData,
      });
    } catch (error) {
      next(error);
    }
  },

  disbandGroup: async (req, res, next) => {
    try {
      const { conversationId } = req.params;
      const currentUserId = req.userId;
      const currentUser = await User.findById(currentUserId);
      await ConversationService.disbandGroup({ currentUserId, conversationId });

      const io = req.app.get("io");
      io.to(conversationId.toString()).emit("group_disbanded", {
        conversationId,
        message: `${currentUser.fullName} đã giải tán nhóm`,
      });

      const sockets = await io.in(conversationId.toString()).fetchSockets();
      for (const s of sockets) s.leave(conversationId.toString());

      return res
        .status(200)
        .json({ code: 1000, message: "Giải tán nhóm thành công" });
    } catch (err) {
      next(err);
    }
  },

  pinMessage: async (req, res, next) => {
    try {
      const { conversationId, messageId } = req.body;
      const userId = req.userId;
      const result = await ConversationService.pinMessage({
        conversationId,
        messageId,
        userId,
      });
      const io = req.app.get("io");
      io.to(conversationId.toString()).emit("message_pinned", result);
      return res.status(200).json(ApiResponse(1000, result));
    } catch (error) {
      next(error);
    }
  },

  unpinMessage: async (req, res, next) => {
    try {
      const { conversationId, messageId } = req.body;
      const userId = req.userId;
      const result = await ConversationService.unpinMessage({
        conversationId,
        messageId,
        userId,
      });
      const io = req.app.get("io");
      io.to(conversationId.toString()).emit("message_unpinned", result);
      return res.status(200).json(ApiResponse(1000, result));
    } catch (error) {
      next(error);
    }
  },

  getPinnedMessages: async (req, res, next) => {
    try {
      const { conversationId } = req.params;
      const result = await ConversationService.getPinnedMessages({
        conversationId,
      });
      return res.status(200).json(ApiResponse(1000, result));
    } catch (error) {
      next(error);
    }
  },

  getOrCreateDirectConversation: async (req, res, next) => {
    try {
      const currentUserId = req.userId;
      const { targetUserId } = req.body;
      const conversation =
        await ConversationService.getOrCreateDirectConversation({
          currentUserId,
          targetUserId,
        });
      return res.status(200).json({
        code: 1000,
        message: "Thành công",
        result: conversation,
      });
    } catch (err) {
      next(err);
    }
  },

  deleteConversation: async (req, res, next) => {
    try {
      const { conversationId } = req.params;
      const userId = req.userId;
      await ConversationService.deleteConversationForUser({
        conversationId,
        userId,
      });
      return res
        .status(200)
        .json({ code: 1000, message: "Xóa cuộc trò chuyện thành công" });
    } catch (err) {
      next(err);
    }
  },

  getGroupMembers: async (req, res, next) => {
    try {
      const { conversationId } = req.params;
      const currentUserId = req.userId;
      const members = await ConversationService.getGroupMembers({
        conversationId,
        currentUserId,
      });
      return res
        .status(200)
        .json({
          code: 1000,
          message: "Lấy danh sách thành viên nhóm thành công",
          result: members,
        });
    } catch (error) {
      next(error);
    }
  },
};

module.exports = { ConversationController };
