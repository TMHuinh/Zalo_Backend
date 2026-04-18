const { ApiResponse } = require("../../utils/response");
const { MessageService } = require("./message.service");
const { model } = require("../../utils/GeminiAI");

function extractJsonFromText(text) {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        return null;
      }
    }
    return null;
  }
}

function normalizeAttachments(rawAttachments = []) {
  if (!Array.isArray(rawAttachments)) return [];

  return rawAttachments
    .filter((item) => item && typeof item === "object" && item.url)
    .map((item) => ({
      type: ["image", "video", "file", "audio"].includes(item.type)
        ? item.type
        : "file",
      url: item.url,
      fileName: item.fileName || "",
      mimeType: item.mimeType || "",
      size: Number(item.size) || 0,
      width: item.width ?? null,
      height: item.height ?? null,
      duration: Number(item.duration) || 0,
    }));
}

const BOT_SENDER_ID = process.env.CHATBOT_USER_ID;

const MessageController = {
  sendMessage: async (req, res, next) => {
    try {
      const {
        conversationId,
        content,
        type,
        replyToMessageId,
        attachments,
        isForwarded,
      } = req.body;

      const senderId = req.userId;
      const files = req.files || [];

      const message = await MessageService.saveMessage({
        conversationId,
        senderId,
        type: type || null,
        content: content || "",
        replyToMessageId: replyToMessageId || null,
        files,
        attachments: attachments || [],
        isForwarded: isForwarded || false,
      });

      const io = req.app.get("io");
      return res.status(201).json(ApiResponse(1000, message));
    } catch (error) {
      next(error);
    }
  },

  sendChatBotMessage: async (req, res, next) => {
    try {
      const { conversationId, content, replyToMessageId } = req.body;
      const userSenderId = req.userId;

      if (!conversationId || !content?.trim()) {
        throw new Error("Thiếu conversationId hoặc content");
      }

      // 1. Lưu tin nhắn user trước
      const userMessage = await MessageService.saveMessage({
        conversationId,
        senderId: userSenderId,
        content: content.trim(),
        type: "text",
        attachments: [],
        replyToMessageId: null,
      });

      let botMessage = null;

      try {
        const prompt = `
Bạn là chatbot hỗ trợ người dùng.

Yêu cầu:
- Trả lời bằng tiếng Việt
- Nội dung chính là HTML đơn giản: p, ul, ol, li, b, i, br
- Không dùng style, script, iframe, table
- Không cần tạo ảnh nếu người dùng không có yêu cầu rõ là tạo ảnh
QUAN TRỌNG:
- Nếu cần hình minh họa:
  + CHỈ sử dụng ảnh từ các nguồn có thật: bằng cách tìm kiếm trên google 
  + URL phải là link trực tiếp
  + Khi tìm hình ảnh trên các nguồn phải tự biết chuyển cái keyword thành tiếng anh để tìm kiếm và lấy về url của ảnh
  + KHÔNG được tự tạo URL giả
  + Nếu không chắc chắn → attachments = []
  + Không tạo ảnh nếu không được yêu cầu
- Nếu không cần ảnh → attachments = []

Định dạng trả về JSON khi có ảnh:
{
  "content": "<p>...</p>",
  "attachments": [
    {
      "type": "image",
      "url": "https://images.unsplash.com/...",
      "fileName": "image.jpg",
      "mimeType": "image/jpeg"
    }
  ]
}
Định dạng trả về JSON khi không có ảnh:
{
  "content": "<p>...</p>",
  "attachments": []
}

Câu hỏi:
${content}
`;

        const result = await model.generateContent(prompt);
        const rawText = result?.response?.text?.() || "";

        let botData = extractJsonFromText(rawText);

        if (!botData) {
          botData = {
            content: rawText?.trim()
              ? `<p>${rawText.trim()}</p>`
              : "<p>Xin lỗi, tôi chưa thể trả lời lúc này.</p>",
            attachments: [],
          };
        }

        const normalizedContent =
          typeof botData.content === "string" && botData.content.trim()
            ? botData.content.trim()
            : "<p>Xin lỗi, tôi chưa thể trả lời lúc này.</p>";

        const normalizedAttachments = normalizeAttachments(botData.attachments);

        botMessage = await MessageService.saveChatbotMessage({
          conversationId,
          chatbotSenderId: BOT_SENDER_ID,
          content: normalizedContent,
          attachments: normalizedAttachments,
          replyToMessageId: null,
        });
      } catch (botError) {
        console.error("❌ Chatbot generate failed:", botError);

        // 2. Nếu chatbot lỗi thì vẫn tạo 1 tin nhắn fallback
        botMessage = await MessageService.saveChatbotMessage({
          conversationId,
          chatbotSenderId: BOT_SENDER_ID,
          content:
            "<p>Xin lỗi, hiện tại chatbot đang gặp lỗi. Bạn vui lòng thử lại sau nhé.</p>",
          attachments: [],
          replyToMessageId: null,
        });
      }

      return res.status(200).json(
        ApiResponse(1000, {
          userMessage,
          botMessage,
        }),
      );
    } catch (error) {
      next(error);
    }
  },
  getMessagesByConversation: async (req, res, next) => {
    try {
      const { conversationId } = req.params;
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 20;

      const result = await MessageService.getMessagesByConversation({
        conversationId,
        page,
        limit,
      });

      return res.status(200).json(ApiResponse(1000, result));
    } catch (error) {
      next(error);
    }
  },

  deleteMessage: async (req, res, next) => {
    try {
      const { messageId } = req.body;
      const message = await MessageService.deleteMessage(messageId);
      const conversationId = message?.conversationId?.toString();
      const io = req.app.get("io");

      if (conversationId && io) {
        io.to(conversationId).emit("message_updated", message);
      }

      return res.status(200).json(ApiResponse(1000, message));
    } catch (error) {
      next(error);
    }
  },

  revokeMessage: async (req, res, next) => {
    try {
      const { messageId } = req.body;
      const message = await MessageService.revokeMessage(messageId);
      const conversationId = message?.conversationId?.toString();
      const io = req.app.get("io");

      if (conversationId && io) {
        io.to(conversationId).emit("message_updated", message);
      }

      return res.status(200).json(ApiResponse(1000, message));
    } catch (error) {
      next(error);
    }
  },

  reactMessage: async (req, res, next) => {
    try {
      const { messageId, emoji } = req.body;
      const userId = req.userId;

      const message = await MessageService.reactMessage({
        messageId,
        userId,
        emoji,
      });

      const conversationId = message?.conversationId?.toString();
      const io = req.app.get("io");

      if (conversationId && io) {
        io.to(conversationId).emit("message_updated", message);
      }

      return res.status(200).json(ApiResponse(1000, message));
    } catch (error) {
      next(error);
    }
  },
  searchMessagesInConversation: async (req, res, next) => {
    try {
      const { conversationId } = req.params;
      const { keyword, page = 1, limit = 20 } = req.query;
      const userId = req.user?.id || req.user?._id;

      const result = await MessageService.searchMessagesInConversation({
        conversationId,
        userId,
        keyword,
        page: Number(page),
        limit: Number(limit),
      });

      return res.status(200).json({
        message: "Tìm tin nhắn thành công",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  },

  getConversationMedia: async (req, res, next) => {
    try {
      const { conversationId } = req.params;
      const { type = "all", page = 1, limit = 30 } = req.query;
      const userId = req.user?.id || req.user?._id;

      const result = await MessageService.getConversationMedia({
        conversationId,
        userId,
        mediaType: type,
        page: Number(page),
        limit: Number(limit),
      });

      return res.status(200).json({
        message: "Lấy media thành công",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  },
};

module.exports = { MessageController };
