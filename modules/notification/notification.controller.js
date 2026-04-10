const { NotificationService } = require("./notification.service");

const NotificationController = {
  getList: async (req, res, next) => {
    try {
      const { page = 1, limit = 10 } = req.query;

      const data = await NotificationService.getList(
        req.userId,
        parseInt(page),
        parseInt(limit)
      );

      res.json({ data });
    } catch (err) {
      next(err);
    }
  },

  getUnreadCount: async (req, res, next) => {
    try {
      const count = await NotificationService.getUnreadCount(req.userId);
      res.json({ count });
    } catch (err) {
      next(err);
    }
  },

  markAsRead: async (req, res, next) => {
    try {
      const data = await NotificationService.markAsRead(
        req.userId,
        req.params.id
      );

      res.json(data);
    } catch (err) {
      next(err);
    }
  },

  markAll: async (req, res, next) => {
    try {
      await NotificationService.markAllAsRead(req.userId);
      res.json({ message: "Đã đọc tất cả" });
    } catch (err) {
      next(err);
    }
  },
};

module.exports = { NotificationController };