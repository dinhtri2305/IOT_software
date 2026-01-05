const mongoose = require("mongoose");
const User = require("./app/models/user.model");

// Hardcoded URI just for this one-time update script
// Lấy từ log kết nối thành công trước đó của bạn
const MONGO_URI = "mongodb+srv://dinhvantri2305:Dinhvantri05@cluster0.vfb5nwj.mongodb.net/fire_detection_db"; 
const CHAT_ID = "8557788740";

async function run() {
  try {
    console.log("Connecting to DB...");
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB");

    const result = await User.updateMany(
      {},
      { 
        $set: { 
          telegramChatId: CHAT_ID, 
          notificationPreference: "TELEGRAM" 
        } 
      }
    );

    console.log(`✅ Success! Updated ${result.modifiedCount} users.`);
    console.log(`Telegram ID set to: ${CHAT_ID}`);
    
    process.exit(0);
  } catch (err) {
    console.error("❌ Error:", err);
    process.exit(1);
  }
}

run();
