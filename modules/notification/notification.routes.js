const express = require("express");
const router = express.Router();
const auth = require("../../middlewares/auth.middleware");
const { NotificationController } = require("./notification.controller");

router.get("/", auth, NotificationController.getList);
router.get("/unread-count", auth, NotificationController.getUnreadCount);
router.patch("/:id/read", auth, NotificationController.markAsRead);
router.patch("/read-all", auth, NotificationController.markAll);

module.exports = router;