const mongoose = require("mongoose");

const attachmentSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["image", "video", "file", "audio"],
      required: true,
    },
    url: {
      type: String,
      required: true,
    },
    fileName: {
      type: String,
      default: "",
    },
    mimeType: {
      type: String,
      default: "",
    },
    size: {
      type: Number,
      default: 0,
    },
    duration: {
      type: Number,
      default: 0,
    },
    width: Number,
    height: Number,
  },
  { _id: false },
);

const reactionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    emoji: {
      type: String,
      required: true,
    },
  },
  { _id: false },
);

const messageSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
      index: true,
    },

    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    type: {
      type: String,
      enum: ["text", "image", "video", "file", "audio", "system", "sticker"],
      default: "text",
    },

    content: {
      type: String,
      default: "",
    },

    attachments: {
      type: [attachmentSchema],
      default: [],
    },

    replyToMessageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },

    reactions: {
      type: [reactionSchema],
      default: [],
    },

    seenBy: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        seenAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    isRecalled: {
      type: Boolean,
      default: false,
    },

    isDeleted: {
      type: Boolean,
      default: false,
    },

    editedAt: {
      type: Date,
      default: null,
    },

    status: {
      type: String,
      enum: ["sent", "delivered", "read", "error"],
      default: "sent",
    },
  },
  { timestamps: true },
);

messageSchema.index({ conversationId: 1, createdAt: -1 });

module.exports = mongoose.model("Message", messageSchema);
