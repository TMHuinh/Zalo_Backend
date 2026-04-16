const { GoogleGenerativeAI } = require("@google/generative-ai");

// init Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// model free phổ biến
const model = genAI.getGenerativeModel({
  model: "gemini-2.5-flash-lite",
});

module.exports = { model };
