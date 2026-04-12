const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    emailOtp: {
      type: String,
    },
    emailOtpExpires: {
      type: Date,
    },
    phone: {
      type: String,
      required: false,
    },
    email: {
      type: String,
      default: null,
      lowercase: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    avatarUrl: {
      type: String,
      default: "",
    },
    coverUrl: {
      type: String,
      default: "",
    },
    bio: {
      type: String,
      default: "",
      maxlength: 300,
    },
    gender: {
      type: String,
      enum: ["male", "female", "other"],
      default: "other",
    },
    dateOfBirth: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ["active", "locked", "deleted"],
      default: "active",
    },
    lastSeenAt: {
      type: Date,
      default: null,
    },
    refreshToken: {
      type: String,
      default: null,
    },
    isOnline: {
      type: Boolean,
      default: false,
    },
    settings: {
      allowStrangerMessage: {
        type: Boolean,
        default: true,
      },
      showPhone: {
        type: Boolean,
        default: false,
      },
      showLastSeen: {
        type: Boolean,
        default: true,
      },
    },
    fullNameNormalized: {
      type: String,
      default: "",
    },
    firstChar: {
      type: String,
      default: "#",
    },
  },
  { timestamps: true },
);

function getLastName(fullName) {
  const parts = fullName.trim().split(/\s+/);
  return parts[parts.length - 1];
}
function buildNameFields(fullName) {
  const lastName = getLastName(fullName);

  const normalized = lastName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim();

  const firstChar = normalized.charAt(0);

  return {
    fullNameNormalized: normalized,
    firstChar: /[a-z]/.test(firstChar) ? firstChar.toUpperCase() : "#",
  };
}

userSchema.pre("save", function () {
  if (this.fullName) {
    const { fullNameNormalized, firstChar } = buildNameFields(this.fullName);
    this.fullNameNormalized = fullNameNormalized;
    this.firstChar = firstChar;
  }
});

userSchema.pre("findOneAndUpdate", function () {
  const update = this.getUpdate();

  if (!update) return;

  if (update.fullName) {
    const { fullNameNormalized, firstChar } = buildNameFields(update.fullName);
    update.fullNameNormalized = fullNameNormalized;
    update.firstChar = firstChar;
  }

  if (update.$set && update.$set.fullName) {
    const { fullNameNormalized, firstChar } = buildNameFields(
      update.$set.fullName,
    );
    update.$set.fullNameNormalized = fullNameNormalized;
    update.$set.firstChar = firstChar;
  }
});

userSchema.index({ firstChar: 1, fullNameNormalized: 1 });

module.exports = mongoose.model("User", userSchema);
