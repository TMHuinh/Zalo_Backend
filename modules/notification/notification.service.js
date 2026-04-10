const Notification = require("../../models/notification.model");

const NotificationService = {
  create: async (payload) => {
    return await Notification.create(payload);
  },

  getUnreadCount: async (userId) => {
    return await Notification.countDocuments({
      userId,
      isRead: false,
    });
  },

  markAsRead: async (userId, notificationId) => {
    return await Notification.findOneAndUpdate(
      { _id: notificationId, userId },
      { isRead: true, readAt: new Date() },
      { new: true }
    );
  },

  markAllAsRead: async (userId) => {
    await Notification.updateMany(
      { userId, isRead: false },
      { isRead: true, readAt: new Date() }
    );
  },

  getList: async (userId, page = 1, limit = 10) => {
    return await Notification.find({ userId })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);
  },
};

module.exports = { NotificationService };