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
        await UserService.updateStatus(userId);

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

    socket.on("send_message", ({ userId, toUserId, message }) => {
      io.to(toUserId.toString()).emit("receive_message", {
        userId,
        message,
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
          await UserService.updateStatus(socket.userId);
        }
        console.log("User disconnected:", socket.id);
      } catch (error) {
        console.error("Disconnect error:", error);
      }
    });
  });
};

module.exports = { handleSocket };
