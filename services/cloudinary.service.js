const cloudinary = require("cloudinary").v2;
const fs = require("fs");
// config
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const uploadImage = async (fileBuffer, filename) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: "avatars", public_id: filename },
      (error, result) => {
        if (error) reject(error);
        else resolve(result.secure_url);
      },
    );
    stream.end(fileBuffer);
  });
};

const getAttachmentType = (mimeType = "") => {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  return "file";
};

const uploadAttachment = async (file) => {
  return new Promise((resolve, reject) => {
    const resourceType = file.mimetype.startsWith("image/")
      ? "image"
      : file.mimetype.startsWith("video/")
        ? "video"
        : file.mimetype.startsWith("audio/")
          ? "video"
          : "raw";

    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "attachment",
        resource_type: resourceType,
      },
      (error, result) => {
        if (error) {
          return reject(error);
        }

        resolve({
          type: getAttachmentType(file.mimetype),
          url: result.secure_url,
          fileName: file.originalname,
          mimeType: file.mimetype,
          size: file.size,
          duration: result.duration || 0,
          width: result.width || null,
          height: result.height || null,
        });
      },
    );

    stream.end(file.buffer);
  });
};

module.exports = { uploadImage, uploadAttachment };
