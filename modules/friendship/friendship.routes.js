const express = require("express");
const router = express.Router();
const authMiddleware = require("../../middlewares/auth.middleware");
const { FriendshipController } = require("./friendship.controller");

router.post("/request", authMiddleware, FriendshipController.sendRequest);
router.post("/request-by-phone", authMiddleware, FriendshipController.sendRequestByPhone);
router.post("/accept", authMiddleware, FriendshipController.acceptRequest);
router.post("/reject", authMiddleware, FriendshipController.rejectRequest);
router.post("/cancel", authMiddleware, FriendshipController.cancelRequest);

router.delete("/unfriend/:friendId", authMiddleware, FriendshipController.unfriend);

router.get("/friends", authMiddleware, FriendshipController.getFriends);
router.get("/pending", authMiddleware, FriendshipController.getPending);
router.get("/status/:userId", authMiddleware, FriendshipController.getStatus);

module.exports = router;