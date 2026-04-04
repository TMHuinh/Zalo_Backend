const { s3 } = require("../config/aws");
const { v4: uuidv4 } = require("uuid");

exports.uploadFile = async (file) => {
  const key = `uploads/${uuidv4()}-${file.originalname}`;

  await s3.upload({
    Bucket: process.env.AWS_BUCKET,
    Key: key,
    Body: file.buffer,
    ContentType: file.mimetype,
  }).promise();

  return `https://${process.env.AWS_BUCKET}.s3.amazonaws.com/${key}`;
};