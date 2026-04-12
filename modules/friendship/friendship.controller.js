const { FriendshipService } = require("./friendship.service");
const { NotificationService } = require("../notification/notification.service");
const { emitNotification } = require("../notification/emitNotification");
const { UserService } = require("../user/user.service");

const FriendshipController = {
  // ===============================
  // 📌 SEND REQUEST
  // ===============================
  sendRequest: async (req, res, next) => {
    try {
      const requesterId = req.userId;
      const { addresseeId } = req.body;

      const result = await FriendshipService.sendRequest(
        requesterId,
        addresseeId,
      );

      if (!result) throw new Error("Cannot send friend request");

      const io = req.app.get("io");

      const requester = await UserService.getUserById(requesterId);

      const noti = await NotificationService.create({
        userId: addresseeId,
        type: "friend_request",
        title: "Lời mời kết bạn",
        content: `${requester.fullName} đã gửi lời mời kết bạn`,
        data: {
          requesterId,
          requesterName: requester.fullName,
          requesterAvatar: requester.avatar,
          friendshipId: result._id,
          status: "pending",
        },
      });

      await emitNotification(io, addresseeId, noti);

      res.json({
        message: "Đã gửi lời mời",
        result,
      });
    } catch (err) {
      next(err);
    }
  },

  // ===============================
  // 📌 SEND REQUEST BY PHONE
  // ===============================
  sendRequestByPhone: async (req, res, next) => {
    try {
      const requesterId = req.userId;
      const { phone } = req.body;

      const result = await FriendshipService.sendRequestByPhone(
        requesterId,
        phone,
      );

      if (!result) throw new Error("User not found by phone");

      const io = req.app.get("io");

      const requester = await UserService.getUserById(requesterId);

      const noti = await NotificationService.create({
        userId: result.addresseeId,
        type: "friend_request",
        title: "Lời mời kết bạn",
        content: `${requester.name} đã gửi lời mời kết bạn`,
        data: {
          requesterId,
          requesterName: requester.name,
          friendshipId: result._id,
          status: "pending",
        },
      });

      await emitNotification(io, result.addresseeId, noti);

      res.json({
        message: "Đã gửi lời mời qua số điện thoại",
        result,
      });
    } catch (err) {
      next(err);
    }
  },

  // ===============================
  // 📌 ACCEPT REQUEST
  // ===============================
  acceptRequest: async (req, res, next) => {
    try {
      const userId = req.userId;
      const { friendshipId } = req.body;

      const result = await FriendshipService.acceptRequest(
        userId,
        friendshipId,
      );

      if (!result) throw new Error("Cannot accept request");

      const io = req.app.get("io");

      const requesterId = result.friendship.requesterId;

      const user = await UserService.getUserById(userId);

      const noti = await NotificationService.create({
        userId: requesterId,
        type: "friend_request",
        title: "Kết bạn thành công",
        content: `${user.name} đã chấp nhận lời mời kết bạn`,
        data: {
          userId,
          friendshipId,
          status: "accepted",
        },
      });

      await emitNotification(io, requesterId, noti);

      io.to(requesterId.toString()).emit(
        "new_conversation",
        result.conversation,
      );

      res.json({
        message: "Đã chấp nhận lời mời",
        result,
      });
    } catch (err) {
      next(err);
    }
  },

  // ===============================
  // 📌 REJECT REQUEST
  // ===============================
  rejectRequest: async (req, res, next) => {
    try {
      const userId = req.userId;
      const { friendshipId } = req.body;

      const result = await FriendshipService.rejectRequest(
        userId,
        friendshipId,
      );

      if (!result) throw new Error("Cannot reject request");

      const io = req.app.get("io");

      const noti = await NotificationService.create({
        userId: result.requesterId,
        type: "friend_request",
        title: "Lời mời kết bạn",
        content: "Lời mời kết bạn đã bị từ chối",
        data: {
          userId,
          friendshipId,
          status: "rejected",
        },
      });

      await emitNotification(io, result.requesterId, noti);

      res.json({
        message: "Đã từ chối lời mời",
        result,
      });
    } catch (err) {
      next(err);
    }
  },

  // ===============================
  // 📌 CANCEL REQUEST
  // ===============================
  cancelRequest: async (req, res, next) => {
    try {
      const userId = req.userId;
      const { friendshipId } = req.body;

      const result = await FriendshipService.cancelRequest(
        userId,
        friendshipId,
      );

      if (!result) throw new Error("Cannot cancel request");

      res.json({
        message: "Đã thu hồi lời mời",
        result,
      });
    } catch (err) {
      next(err);
    }
  },

  // ===============================
  // 📌 UNFRIEND
  // ===============================
  unfriend: async (req, res, next) => {
    try {
      const userId = req.userId;
      const { friendId } = req.params;

      const result = await FriendshipService.unfriend(userId, friendId);

      if (!result) throw new Error("Cannot unfriend");

      const io = req.app.get("io");

      const noti = await NotificationService.create({
        userId: friendId,
        type: "system",
        title: "Huỷ kết bạn",
        content: "Bạn và người này không còn là bạn bè",
        data: {
          userId,
          status: "unfriend",
        },
      });

      await emitNotification(io, friendId, noti);

      res.json({
        message: "Đã huỷ kết bạn",
        result,
      });
    } catch (err) {
      next(err);
    }
  },

  // ===============================
  // 📌 GET FRIENDS
  // ===============================
  getFriends: async (req, res, next) => {
    try {
      const data = await FriendshipService.getFriends(req.userId);
      res.json({ data });
    } catch (err) {
      next(err);
    }
  },

  // ===============================
  // 📌 GET PENDING
  // ===============================
  getPending: async (req, res, next) => {
    try {
      const data = await FriendshipService.getPendingRequests(req.userId);
      res.json({ data });
    } catch (err) {
      next(err);
    }
  },

  // ===============================
  // 📌 GET STATUS
  // ===============================
  getStatus: async (req, res, next) => {
    try {
      const userId = req.userId;
      const { userId: otherUserId } = req.params;

      const result = await FriendshipService.getRelationshipStatus(
        userId,
        otherUserId,
      );

      res.json(result);
    } catch (err) {
      next(err);
    }
  },
};

module.exports = { FriendshipController };
