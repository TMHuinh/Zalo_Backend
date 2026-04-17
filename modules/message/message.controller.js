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
      const { conversationId, content, type, replyToMessageId, attachments, isForwarded } =
        req.body;

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
        replyToMessageId: replyToMessageId || null,
      });

      let botMessage = null;

      try {
        const prompt = `
Bạn là chatbot hỗ trợ người dùng.
Yêu cầu:
- Trả lời bằng tiếng Việt
- Ngắn gọn, thân thiện
- Nội dung chính phải là HTML đơn giản, chỉ dùng các thẻ: p, ul, ol, li, b, i, br
- Không dùng style inline, script, iframe, table
- Nếu không cần file đính kèm thì attachments là []
- Nếu có hình/file minh họa thì đưa vào attachments bằng URL tuyệt đối hợp lệ
- Chỉ trả về JSON hợp lệ, không bọc markdown, không giải thích thêm

Định dạng:
{
  "content": "<p>...</p>",
  "attachments": [
    {
      "type": "image",
      "url": "https://example.com/demo.png",
      "fileName": "demo.png",
      "mimeType": "image/png"
    }
  ]
}

Câu hỏi người dùng:
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
          replyToMessageId: userMessage._id,
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
          replyToMessageId: userMessage._id,
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
};

module.exports = { MessageController };
