const { ConversationService } = require("./conversation.service");

const ConversationController = {

    getByUserId: async (req, res, next) => {
        try {
        const userId = req.userId; // lấy từ authMiddleware

        const result = await ConversationService.getConversationByUserId(
            userId
        );

        res.json({
            code: 1000,
            message: "Get conversation successfully",
            result,
        });
        } catch (err) {
        next(err);
        }
    },
};

module.exports = { ConversationController };