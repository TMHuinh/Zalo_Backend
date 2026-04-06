const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      dbName: process.env.DB_NAME || "test",
    });

    console.log(`✅ MongoDB connected: ${conn.connection.host}`);
  } catch (error) {
    console.error("❌ MongoDB error:", error.message);
    process.exit(1);
  }
};

module.exports = connectDB;
