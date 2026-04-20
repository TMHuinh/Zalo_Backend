const {
  ConversationService,
} = require("../modules/conversation/conversation.service");
const { UserService } = require("../modules/user/user.service");

const handleSocket = (io) => {
  io.on("connection", (socket) => {
    console.log("Socket connected:", socket.id);

    socket.on("join", async (userId) => {
      try {
        if (!userId) return;
        socket.userId = userId;
        // join room cá nhân để nhận direct message
        socket.join(userId.toString());

        // cập nhật online
        await UserService.updateStatus(userId, true);

        // join các group của user
        const groups =
          await ConversationService.getGroupConversationByUserId(userId);

        groups.forEach((group) => {
          socket.join(group._id.toString());
        });

        console.log(`User ${userId} joined personal room and group rooms`);
      } catch (error) {
        console.error("Join error:", error);
      }
    });

    socket.on("send_message", ({ userId, toUserId, message, type }) => {
      console.log(`User ${userId} sends message to ${toUserId}: ${message}`);
      io.to(toUserId.toString()).emit("receive_message", {
        userId,
        message,
        type,
      });
    });

    socket.on("send_group_message", ({ groupId, userId, message }) => {
      io.to(groupId.toString()).emit("receive_group_message", {
        groupId,
        userId,
        message,
      });
    });

    socket.on("disconnect", async () => {
      try {
        if (socket.userId) {
          await UserService.updateStatus(socket.userId, false);
        }
        console.log("User disconnected:", socket.id);
      } catch (error) {
        console.error("Disconnect error:", error);
      }
    });

    socket.on(
      "recall_message",
      ({ type, toUserId, groupId, messageId, conversationId }) => {
        console.log(`User recalls message: ${messageId}`);

        const payload = {
          messageId,
          conversationId, // 🔥 THÊM CÁI NÀY
        };

        if (type === "group" && groupId) {
          io.to(groupId.toString()).emit("message_recalled", payload);
          return;
        }

        if (type === "direct" && toUserId) {
          io.to(toUserId.toString()).emit("message_recalled", payload);
        }
      },
    );

    socket.on("delete_message", ({ toUserId, messageId }) => {
      console.log(`User deletes message: ${messageId}`);
      io.to(toUserId.toString()).emit("message_deleted", {
        messageId,
      });
    });

    socket.on("join_conversation", (conversationId) => {
      socket.join(conversationId.toString());
      console.log("JOIN ROOM:", conversationId);
    });

    socket.on("leave_conversation", (conversationId) => {
      socket.leave(conversationId.toString());
    });
    // ===== REACTION =====
    socket.on(
      "react_message",
      ({ type, toUserId, groupId, userId, message }) => {
        if (!message?._id) return;

        const payload = {
          userId,
          message,
        };

        if (type === "group" && groupId) {
          io.to(groupId.toString()).emit("message_reacted", payload);
          return;
        }

        if (type === "direct" && toUserId) {
          io.to(toUserId.toString()).emit("message_reacted", payload);
        }
      }
    );

    // ===== PIN =====
    socket.on(
      "pin_message",
      ({ type, toUserId, groupId, userId, message }) => {

        if (!message?._id) return;

        const payload = {
          userId,
          message,
        };

        if (type === "group" && groupId) {
          io.to(groupId.toString()).emit("message_pinned", payload);
          return;
        }

        if (type === "direct" && toUserId) {
          io.to(toUserId.toString()).emit("message_pinned", payload);
        }
      }
    );
    // THÊM MỚI
    socket.on("disband_group", ({ conversationId, userId, groupName }) => {
      if (!conversationId) return;

      console.log(`Group disbanded: ${conversationId} by user ${userId}`);

      const payload = {
        conversationId,
        userId,
        groupName: groupName || "",
        message: groupName?.trim()
          ? `Nhóm "${groupName}" đã bị giải tán`
          : "Nhóm đã bị giải tán",
      };

      // socket.to để không bắn lại cho chính owner
      socket.to(conversationId.toString()).emit("group_disbanded", payload);
    });

    // ===== UNPIN =====
    socket.on(
      "unpin_message",
      ({ type, toUserId, groupId, userId, message }) => {
        if (!message?._id) return;

        const payload = {
          userId,
          message,
        };

        if (type === "group" && groupId) {
          io.to(groupId.toString()).emit("message_unpinned", payload);
          return;
        }

        if (type === "direct" && toUserId) {
          io.to(toUserId.toString()).emit("message_unpinned", payload);
        }
      }
    );
  });
};

module.exports = { handleSocket };
