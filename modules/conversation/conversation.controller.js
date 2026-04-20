const { ApiResponse } = require("../../utils/response");
const { ConversationService } = require("./conversation.service");

const ConversationController = {
  getByUserId: async (req, res, next) => {
    try {
      const userId = req.userId; // lấy từ authMiddleware

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

      const io = req.app.get("io");
      // owner join room group nếu cần
      await io
        .in(currentUserId.toString())
        .socketsJoin(conversation._id.toString());

      // chỉ gửi cho các thành viên mới được thêm
      const addedMemberIds = [
        ...new Set(memberIds.map((id) => id.toString())),
      ].filter((id) => id && id !== currentUserId.toString());

      for (const userId of addedMemberIds) {
        await io.in(userId).socketsJoin(conversation._id.toString());

        io.to(userId).emit("added_to_group", {
          conversationId: conversation._id.toString(),
          groupName: conversation.name,
          avatarUrl: conversation.avatarUrl || "",
          createdAt: conversation.createdAt,
        });
      }

      return res.status(200).json({
        message: "Tạo nhóm thành công",
        data: conversation,
      });
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
  updateGroupInfo: async (req, res, next) => {
    try {
      const currentUserId = req.userId;
      const { conversationId } = req.params;
      const { name, avatarUrl } = req.body;
      console.log(req.file);
      const conversation = await ConversationService.updateGroupInfo({
        currentUserId,
        conversationId,
        name,
        avatarUrl,
        file: req.file,
      });

      return res.status(200).json({
        code: 1000,
        message: "Cập nhật thông tin nhóm thành công",
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

      return res.status(200).json({
        code: 1000,
        message: "Xóa cuộc trò chuyện thành công",
      });
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

      return res.status(200).json({
        code: 1000,
        message: "Lấy danh sách thành viên nhóm thành công",
        result: members,
      });
    } catch (error) {
      next(error);
    }
  },
  removeMemberFromGroup: async (req, res, next) => {
    try {
      const { conversationId, memberId } = req.params;
      const currentUserId = req.userId;

      const result = await ConversationService.removeMemberFromGroup({
        currentUserId,
        conversationId,
        memberId,
      });
      const io = req.app.get("io");
      // 1) ngắt mọi socket đang online của member này khỏi room group
      await io.in(memberId.toString()).socketsLeave(conversationId.toString());

      // 2) báo cho chính member đó biết là bị xóa khỏi nhóm
      io.to(memberId.toString()).emit("removed_from_group", {
        conversationId: conversationId.toString(),
        removedBy: currentUserId?.toString() ?? "",
        message: "Bạn đã bị xóa khỏi nhóm",
      });

      return res.status(200).json({
        code: 1000,
        message: "Xóa thành viên khỏi nhóm thành công",
        result,
      });
    } catch (error) {
      next(error);
    }
  },
  assignGroupOwner: async (req, res, next) => {
    try {
      const { conversationId } = req.params;
      const { memberId } = req.body;
      const currentUserId = req.userId;

      const result = await ConversationService.assignGroupOwner({
        currentUserId,
        conversationId,
        memberId,
      });

      return res.status(200).json({
        code: 1000,
        message: "Bổ nhiệm trưởng nhóm thành công",
        result,
      });
    } catch (error) {
      next(error);
    }
  },
  disbandGroup: async (req, res, next) => {
    try {
      const { conversationId } = req.params;
      const currentUserId = req.userId;

      await ConversationService.disbandGroup({
        currentUserId,
        conversationId,
      });

      return res.status(200).json({
        code: 1000,
        message: "Giải tán nhóm thành công",
      });
    } catch (err) {
      next(err);
    }
  },
  addMembersToGroup: async (req, res, next) => {
    try {
      const { conversationId } = req.params;
      const { memberIds } = req.body; // Mảng các ID muốn thêm
      const currentUserId = req.userId;

      const result = await ConversationService.addMembersToGroup({
        currentUserId,
        conversationId,
        memberIds,
      });

      return res.status(200).json({
        code: 1000,
        message: "Thêm thành viên thành công",
        result,
      });
    } catch (err) {
      next(err);
    }
  },
  leaveGroup: async (req, res, next) => {
    try {
      const { conversationId } = req.params;
      const currentUserId = req.userId;

      const result = await ConversationService.leaveGroup({
        currentUserId,
        conversationId,
      });
      const io = req.app.get("io");
      io.in(currentUserId.toString()).socketsLeave(conversationId.toString());

      return res.status(200).json({
        code: 1000,
        message: "Rời nhóm thành công",
        result,
      });
    } catch (error) {
      next(error);
    }
  },
};

module.exports = { ConversationController };
