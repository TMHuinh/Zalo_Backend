const { FriendshipService } = require("./friendship.service");

const FriendshipController = {
  sendRequest: async (req, res, next) => {
    try {
      const requesterId = req.userId;
      const { addresseeId } = req.body;
      const result = await FriendshipService.sendRequest(requesterId, addresseeId);

      const io = req.app.get("io");
      io.to(addresseeId.toString()).emit("friend_request_received", { requesterId });

      res.json({ message: "Đã gửi lời mời", result });
    } catch (err) {
      next(err);
    }
  },

  // SEND BY PHONE
  sendRequestByPhone: async (req, res, next) => {
    try {
      const requesterId = req.userId;
      const { phone } = req.body;

      const result = await FriendshipService.sendRequestByPhone(requesterId, phone);
      const io = req.app.get("io");

      io.to(result.addresseeId.toString()).emit("friend_request_received", { requesterId });

      res.json({ message: "Đã gửi lời mời qua số điện thoại", result });
    } catch (err) {
      next(err);
    }
  },

  acceptRequest: async (req, res, next) => {
    try {
      const userId = req.userId;
      const { friendshipId } = req.body;
      const result = await FriendshipService.acceptRequest(userId, friendshipId);

      const io = req.app.get("io");
      io.to(result.friendship.requesterId.toString()).emit("friend_request_accepted", { userId });
      io.to(result.friendship.requesterId.toString()).emit("new_conversation", result.conversation);

      res.json({ message: "Đã chấp nhận", result });
    } catch (err) { next(err); }
  },

  rejectRequest: async (req, res, next) => {
    try {
      const userId = req.userId;
      const { friendshipId } = req.body;
      const result = await FriendshipService.rejectRequest(userId, friendshipId);

      const io = req.app.get("io");
      io.to(result.requesterId.toString()).emit("friend_request_rejected", { userId });

      res.json({ message: "Đã từ chối", result });
    } catch (err) { next(err); }
  },

  cancelRequest: async (req, res, next) => {
    try {
      const userId = req.userId;
      const { friendshipId } = req.body;
      const result = await FriendshipService.cancelRequest(userId, friendshipId);
      res.json(result);
    } catch (err) { next(err); }
  },

  unfriend: async (req, res, next) => {
    try {
      const userId = req.userId;
      const { friendId } = req.params;
      const result = await FriendshipService.unfriend(userId, friendId);

      const io = req.app.get("io");
      io.to(friendId.toString()).emit("friend_removed", { userId });

      res.json(result);
    } catch (err) { next(err); }
  },

  getFriends: async (req, res, next) => {
    try {
      const data = await FriendshipService.getFriends(req.userId);
      res.json({ data });
    } catch (err) { next(err); }
  },

  getPending: async (req, res, next) => {
    try {
      const data = await FriendshipService.getPendingRequests(req.userId);
      res.json({ data });
    } catch (err) { next(err); }
  },

  getStatus: async (req, res, next) => {
    try {
      const userId = req.userId;
      const { userId: otherUserId } = req.params;
      const result = await FriendshipService.getRelationshipStatus(userId, otherUserId);
      res.json(result);
    } catch (err) { next(err); }
  },
};

module.exports = { FriendshipController };