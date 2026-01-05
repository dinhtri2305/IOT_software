const mongoose = require("mongoose");
const User = require("../app/models/user.model");
require("dotenv").config({ path: "./.env" });

const CHAT_ID = "8557788740";

async function updateAllUsers() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to DB");

    // Update ALL users to use this ChatID and prefer Telegram
    // (For testing purposes, simpler than finding a specific ID)
    const result = await User.updateMany(
      {}, 
      { 
        $set: { 
          telegramChatId: CHAT_ID,
          notificationPreference: "TELEGRAM" 
        } 
      }
    );

    console.log(`✅ Updated ${result.modifiedCount} users.`);
    console.log(`Telegram Chat ID set to: ${CHAT_ID}`);
    console.log("Notification Preference set to: TELEGRAM");
    
    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

updateAllUsers();
