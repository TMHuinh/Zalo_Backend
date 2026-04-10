const { NotificationService } = require("./notification.service");

const emitNotification = async (io, userId, noti) => {
  const unreadCount = await NotificationService.getUnreadCount(userId);

  // 🔔 notification mới
  io.to(userId.toString()).emit("notification:new", noti);

  // 🔢 badge
  io.to(userId.toString()).emit("notification:badge", {
    unreadCount,
  });
};

module.exports = { emitNotification };