const { ApiResponse } = require("../../utils/response");
const { MessageService } = require("./message.service");
const Conversation = require("../../models/conversation.model");
const { model } = require("../../utils/GeminiAI");

const emitNewMessageEvents = async (io, conversationId, message, senderId) => {
  io.to(conversationId.toString()).emit("new_message", message);

  const conversation = await Conversation.findById(conversationId)
    .populate("lastMessageId")
    .populate("members.userId", "_id fullName avatarUrl isOnline");
  if (!conversation) return;

  const convData = conversation.toObject
    ? conversation.toObject()
    : conversation;
  const msgTime = new Date(message.createdAt || Date.now()).getTime();
  conversation.members.forEach((member) => {
    const uid = member.userId?._id || member.userId;
    const deletedTime = member.deletedAt
      ? new Date(member.deletedAt).getTime()
      : 0;
    if (
      member.deletedAt &&
      msgTime > deletedTime &&
      uid?.toString() !== senderId.toString()
    ) {
      io.to(uid.toString()).emit("new_conversation", convData);
    }
  });
};

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
      const isViolation = await isViolationContent(content);

      if (isViolation) {
        return res.status(400).json(
          ApiResponse(4001, {
            isViolation: true,
            message: "Tin nhắn chứa nội dung vi phạm quy tắc cộng đồng.",
          }),
        );
      }
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
      emitNewMessageEvents(io, conversationId, message, senderId);

      return res.status(201).json(ApiResponse(1000, message));
    } catch (error) {
      next(error);
    }
  },

  sendChatBotMessage: async (req, res, next) => {
    try {
      const { conversationId, content, replyToMessageId, topic } = req.body;
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
- Chỉ trả lời các câu hỏi liên quan đến topic là ${topic}
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

      const io = req.app.get("io");
      if (userMessage) {
        emitNewMessageEvents(io, conversationId, userMessage, userSenderId);
      }
      if (botMessage) {
        emitNewMessageEvents(
          io,
          conversationId,
          botMessage,
          BOT_SENDER_ID,
        );
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
      const userId = req.userId; // Lấy từ authMiddleware
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 20;

      const result = await MessageService.getMessagesByConversation({
        conversationId,
        userId, // TRUYỀN USERID XUỐNG SERVICE
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
  summarizeConversationContent: async (req, res, next) => {
    try {
      const messages = getMessagesFromBody(req.body);

      if (!Array.isArray(messages) || messages.length === 0) {
        throw new Error("Thiếu dữ liệu tin nhắn cần tóm tắt");
      }

      const transcript = buildSummaryTranscript(messages);

      if (!transcript.trim()) {
        return res.status(200).json(
          ApiResponse(1000, {
            summary:
              "<p>Cuộc trò chuyện chưa có nội dung văn bản để tóm tắt.</p>",
            keyPoints: [],
            actionItems: [],
          }),
        );
      }

      const prompt = `
Bạn là trợ lý tóm tắt nội dung cuộc trò chuyện.

Yêu cầu bắt buộc:
- Trả lời bằng tiếng Việt
- Chỉ tóm tắt dựa trên dữ liệu hội thoại được cung cấp
- Không bịa thêm thông tin ngoài nội dung hội thoại
- Nếu có tin nhắn âm thanh chưa có transcript, chỉ ghi nhận là có audio, không đoán nội dung audio
- Bỏ qua các thông tin kỹ thuật như _id, seenBy, avatarUrl, __v, status
- Nội dung HTML đơn giản, chỉ dùng: p, ul, ol, li, b, i, br
- Không dùng style, script, iframe, table
- Nếu có việc cần làm rõ ràng thì đưa vào actionItems
- Nếu không có việc cần làm thì actionItems = []

Trả về đúng JSON, không markdown, không giải thích ngoài JSON:
{
  "summary": "<p>...</p>",
  "keyPoints": ["ý chính 1", "ý chính 2"],
  "actionItems": ["việc cần làm 1", "việc cần làm 2"]
}

Dữ liệu hội thoại đã được làm sạch, sắp xếp từ cũ đến mới:
"""
${transcript}
"""
`;

      const result = await model.generateContent(prompt);
      const rawText = result?.response?.text?.() || "";

      let summaryData = extractJsonFromText(rawText);

      if (!summaryData) {
        summaryData = {
          summary: rawText?.trim()
            ? `<p>${stripHtml(rawText.trim())}</p>`
            : "<p>Không thể tóm tắt nội dung lúc này.</p>",
          keyPoints: [],
          actionItems: [],
        };
      }

      return res.status(200).json(
        ApiResponse(1000, {
          summary:
            typeof summaryData.summary === "string" &&
            summaryData.summary.trim()
              ? summaryData.summary.trim()
              : "<p>Không thể tóm tắt nội dung lúc này.</p>",

          keyPoints: Array.isArray(summaryData.keyPoints)
            ? summaryData.keyPoints.filter((item) => typeof item === "string")
            : [],

          actionItems: Array.isArray(summaryData.actionItems)
            ? summaryData.actionItems.filter((item) => typeof item === "string")
            : [],
        }),
      );
    } catch (error) {
      next(error);
    }
  },
};

////////HELPER//////////////////

function stripHtml(input = "") {
  return String(input)
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getSenderName(senderId) {
  if (!senderId) return "Không rõ";

  if (typeof senderId === "object") {
    return senderId.fullName || senderId.name || senderId._id || "Không rõ";
  }

  return String(senderId);
}

function formatAttachmentForSummary(attachment) {
  if (!attachment) return "";

  if (attachment.type === "audio") {
    return `[Tin nhắn âm thanh: ${attachment.fileName || "audio"}, thời lượng ${
      attachment.duration || 0
    } giây. Chưa có transcript nên không biết nội dung audio.]`;
  }

  if (attachment.type === "image") {
    return `[Hình ảnh: ${attachment.fileName || attachment.url || "image"}]`;
  }

  if (attachment.type === "video") {
    return `[Video: ${attachment.fileName || attachment.url || "video"}]`;
  }

  return `[Tệp đính kèm: ${attachment.fileName || attachment.url || "file"}]`;
}

function buildSummaryTranscript(messages = []) {
  if (!Array.isArray(messages)) return "";

  return messages
    .filter((msg) => msg && !msg.isDeleted && !msg.isRecalled)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
    .map((msg) => {
      const senderName = getSenderName(msg.senderId);

      const time = msg.createdAt
        ? new Date(msg.createdAt).toLocaleString("vi-VN", {
            timeZone: "Asia/Ho_Chi_Minh",
          })
        : "";

      const content = stripHtml(msg.content || msg.transcript || "");

      const attachments = Array.isArray(msg.attachments)
        ? msg.attachments
            .map(formatAttachmentForSummary)
            .filter(Boolean)
            .join(" ")
        : "";

      const replyContent = msg.replyToMessageId?.content
        ? `Trả lời tin nhắn: "${stripHtml(msg.replyToMessageId.content)}".`
        : "";

      const finalText = [content, attachments, replyContent]
        .filter(Boolean)
        .join(" ");

      if (!finalText.trim()) return null;

      return `[${time}] ${senderName}: ${finalText}`;
    })
    .filter(Boolean)
    .join("\n");
}

function getMessagesFromBody(body) {
  // FE gửi thẳng result.data
  if (Array.isArray(body)) return body;

  // Phòng trường hợp sau này FE đổi sang { messages: [...] }
  if (Array.isArray(body?.messages)) return body.messages;

  return [];
}

async function isViolationContent(content = "") {
  const text = stripHtml(content || "");

  if (!text.trim()) return false;

  const prompt = `
Bạn là hệ thống kiểm duyệt nội dung tiếng Việt cho ứng dụng chat.

Nhiệm vụ:
- Kiểm tra nội dung người dùng có vi phạm hay không.
- Nếu có vi phạm trả về isViolation = true.
- Nếu không vi phạm trả về isViolation = false.

Các loại nội dung được xem là vi phạm:
- Chửi thề, thô tục, xúc phạm người khác
- Phân biệt vùng miền, miệt thị địa phương
- Phân biệt giới tính, tôn giáo, dân tộc, ngoại hình
- Công kích cá nhân, nhục mạ, bắt nạt
- Đe dọa, kích động bạo lực
- Nội dung khiêu dâm hoặc quấy rối tình dục
- Ngôn từ thù ghét

Không xem là vi phạm nếu:
- Người dùng đang hỏi nghĩa của một từ xấu
- Người dùng trích dẫn để báo cáo hoặc nhờ kiểm tra
- Nội dung có từ nhạy cảm nhưng không dùng để xúc phạm ai

Trả về đúng JSON, không markdown, không giải thích:
{
  "isViolation": true,
  "reason": "lý do ngắn gọn"
}

Hoặc:
{
  "isViolation": false,
  "reason": ""
}

Nội dung cần kiểm tra:
"""
${text.slice(0, 4000)}
"""
`;

  try {
    const result = await model.generateContent(prompt);
    const rawText = result?.response?.text?.() || "";

    const data = extractJsonFromText(rawText);

    return data?.isViolation === true;
  } catch (error) {
    console.error("❌ Violation check failed:", error);

    // Chọn false để tránh AI lỗi làm người dùng không gửi được tin nhắn
    return false;
  }
}

module.exports = { MessageController };
