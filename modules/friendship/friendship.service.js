const Friendship = require("../../models/friendship.model");
const User = require("../../models/user.model"); // model user
const { AppError } = require("../../utils/AppError");
const mongoose = require("mongoose");
const Conversation = require("../../models/conversation.model");

const FriendshipService = {
  // ===============================
  // 📌 SEND REQUEST
  // ===============================
  sendRequest: async (requesterId, addresseeId) => {
    if (!mongoose.Types.ObjectId.isValid(addresseeId)) {
      throw AppError(400, "ID không hợp lệ", 1400);
    }

    if (requesterId.toString() === addresseeId) {
      throw AppError(400, "Không thể kết bạn với chính mình", 1401);
    }

    const existing = await Friendship.findOne({
      $or: [
        { requesterId, addresseeId },
        { requesterId: addresseeId, addresseeId: requesterId },
      ],
    });

    if (existing) {
      if (existing.status === "accepted") throw AppError(400, "Đã là bạn bè", 1402);
      if (existing.status === "pending") throw AppError(400, "Đã gửi lời mời trước đó", 1403);
      if (existing.status === "blocked") throw AppError(403, "Không thể gửi lời mời", 1404);
      if (existing.status === "rejected") {
        existing.status = "pending";
        existing.requesterId = requesterId;
        existing.addresseeId = addresseeId;
        existing.actionBy = null;
        await existing.save();
        return existing;
      }
    }

    return await Friendship.create({
      requesterId,
      addresseeId,
      status: "pending",
    });
  },

  // ===============================
  // 📌 SEND REQUEST BY PHONE
  // ===============================
  sendRequestByPhone: async (requesterId, phone) => {
    const user = await User.findOne({ phone });
    if (!user) throw AppError(404, "Không tìm thấy người dùng với số điện thoại này", 1404);

    // không thể tự kết bạn
    if (user._id.toString() === requesterId) throw AppError(400, "Không thể kết bạn với chính mình", 1401);

    return await FriendshipService.sendRequest(requesterId, user._id);
  },

  // ===============================
  // 📌 ACCEPT REQUEST
  // ===============================
  acceptRequest: async (userId, friendshipId) => {
    if (!mongoose.Types.ObjectId.isValid(friendshipId)) throw AppError(400, "ID không hợp lệ", 1400);

    const friendship = await Friendship.findById(friendshipId);
    if (!friendship) throw AppError(404, "Không tìm thấy", 1404);

    if (friendship.addresseeId.toString() !== userId) throw AppError(403, "Không có quyền", 1403);
    if (friendship.status !== "pending") throw AppError(400, "Yêu cầu không hợp lệ", 1405);

    friendship.status = "accepted";
    friendship.actionBy = userId;
    await friendship.save();

    let conversation = await Conversation.findOne({
      type: "direct",
      "members.userId": { $all: [friendship.requesterId, friendship.addresseeId] },
    });

    if (!conversation) {
      conversation = await Conversation.create({
        type: "direct",
        members: [
          { userId: friendship.requesterId },
          { userId: friendship.addresseeId },
        ],
      });
    }

    return { friendship, conversation };
  },

  // ===============================
  // 📌 REJECT REQUEST
  // ===============================
  rejectRequest: async (userId, friendshipId) => {
    if (!mongoose.Types.ObjectId.isValid(friendshipId)) throw AppError(400, "ID không hợp lệ", 1400);

    const friendship = await Friendship.findById(friendshipId);
    if (!friendship) throw AppError(404, "Không tìm thấy", 1404);
    if (friendship.addresseeId.toString() !== userId) throw AppError(403, "Không có quyền", 1403);
    if (friendship.status !== "pending") throw AppError(400, "Yêu cầu không hợp lệ", 1405);

    friendship.status = "rejected";
    friendship.actionBy = userId;
    await friendship.save();

    return friendship;
  },

  // ===============================
  // 📌 CANCEL REQUEST
  // ===============================
  cancelRequest: async (userId, friendshipId) => {
    const friendship = await Friendship.findById(friendshipId);
    if (!friendship) throw AppError(404, "Không tìm thấy", 1404);
    if (friendship.requesterId.toString() !== userId) throw AppError(403, "Không có quyền", 1403);
    if (friendship.status !== "pending") throw AppError(400, "Không thể huỷ", 1405);

    await friendship.deleteOne();
    return { message: "Đã huỷ lời mời" };
  },

  // ===============================
  // 📌 UNFRIEND
  // ===============================
  unfriend: async (userId, friendId) => {
    const userObjectId = new mongoose.Types.ObjectId(userId);
    const friendObjectId = new mongoose.Types.ObjectId(friendId);

    const friendship = await Friendship.findOne({
      status: "accepted",
      $or: [
        { requesterId: userObjectId, addresseeId: friendObjectId },
        { requesterId: friendObjectId, addresseeId: userObjectId },
      ],
    });

    if (!friendship) throw AppError(404, "Không phải bạn bè", 1404);

    await friendship.deleteOne();
    return { message: "Đã huỷ kết bạn" };
  },

  // ===============================
  // 📌 GET FRIENDS
  // ===============================
  getFriends: async (userId) => {
    const friendships = await Friendship.find({
      status: "accepted",
      $or: [{ requesterId: userId }, { addresseeId: userId }],
    })
      .populate("requesterId", "fullName avatarUrl isOnline")
      .populate("addresseeId", "fullName avatarUrl isOnline");

    return friendships.map(f => {
      const friend = f.requesterId._id.toString() === userId ? f.addresseeId : f.requesterId;
      return { _id: f._id, friend };
    });
  },

  // ===============================
  // 📌 GET PENDING
  // ===============================
  getPendingRequests: async (userId) => {
    return await Friendship.find({
      addresseeId: userId,
      status: "pending",
    }).populate("requesterId", "fullName avatarUrl isOnline");
  },

  // ===============================
  // 📌 RELATIONSHIP STATUS
  // ===============================
  getRelationshipStatus: async (userId, otherUserId) => {
    const friendship = await Friendship.findOne({
      $or: [
        { requesterId: userId, addresseeId: otherUserId },
        { requesterId: otherUserId, addresseeId: userId },
      ],
    });

    if (!friendship) return { status: "none" };
    return { status: friendship.status, isRequester: friendship.requesterId.toString() === userId };
  },
};

module.exports = { FriendshipService };