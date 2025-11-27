// app/config/db.config.js
const mongoose = require("mongoose");

// Tự động retry khi mất kết nối (rất quan trọng khi deploy online)
const MAX_RETRIES = 30;
const RETRY_INTERVAL = 5000; // 5 giây

const connectDB = async () => {
  let retries = 0;

  const connectWithRetry = async () => {
    try {
      const conn = await mongoose.connect(process.env.MONGODB_URI, {
        // TỐI ƯU 2025 – KHÔNG DÙNG CÁI CŨ NỮA
        maxPoolSize: 10, // Connection pool (rất quan trọng)
        serverSelectionTimeoutMS: 5000, // Timeout nhanh nếu DB chết
        socketTimeoutMS: 45000, // Đóng socket nếu treo
        // Note: newer mongoose/mongo drivers no longer support `bufferMaxEntries` and
        // `bufferCommands` options. They caused runtime errors in modern versions.
        // heartbeatFrequencyMS: 10000, // Kiểm tra kết nối mỗi 10s (optional)
      });

      console.log("MongoDB Connected");
      console.log(`Host: ${conn.connection.host}`);
      console.log(`Database: ${conn.connection.name}`);

      // Reset retry count khi kết nối thành công
      retries = 0;
    } catch (error) {
      console.error("MongoDB Connection Failed:", error.message);

      if (retries < MAX_RETRIES) {
        retries++;
        console.log(`Retrying connection... (${retries}/${MAX_RETRIES})`);
        setTimeout(connectWithRetry, RETRY_INTERVAL);
      } else {
        console.error("Max retries reached. Shutting down...");
        process.exit(1);
      }
    }
  };

  // Bắt đầu kết nối
  connectWithRetry();

  // ==================== SỰ KIỆN KẾT NỐI ====================
  mongoose.connection.on("connected", () => {
    console.log("Mongoose connected to MongoDB");
  });

  mongoose.connection.on("error", (err) => {
    console.error("Mongoose connection error:", err.message);
  });

  mongoose.connection.on("disconnected", () => {
    console.warn("Mongoose disconnected – attempting to reconnect...");
    if (retries < MAX_RETRIES) {
      setTimeout(connectWithRetry, RETRY_INTERVAL);
    }
  });

  // Khi Node.js tắt → đóng DB sạch sẽ
  process.on("SIGINT", async () => {
    try {
      await mongoose.connection.close();
      console.log("MongoDB connection closed gracefully");
      process.exit(0);
    } catch (err) {
      console.error("Error during shutdown:", err);
      process.exit(1);
    }
  });
};

module.exports = connectDB;
