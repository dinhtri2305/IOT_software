const TelegramBot = require("node-telegram-bot-api");

let bot = null;

// Initialize Bot if Token is present
if (process.env.TELEGRAM_BOT_TOKEN) {
  try {
    bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });
    console.log("✅ Telegram Bot initialized successfully!");

    // Listener to help users find their Chat ID
    bot.on("message", (msg) => {
      const chatId = msg.chat.id;
      const username = msg.from.username || msg.from.first_name;
      console.log(`\n📩 Telegram Message from [${username}]: "${msg.text}"`);
      console.log(`🆔 YOUR CHAT ID IS: ${chatId}`);
      console.log("---------------------------------------------------");
      
      bot.sendMessage(chatId, `Xin chào! Chat ID của bạn là: ${chatId}\nHãy nhập ID này vào hệ thống IoT để nhận cảnh báo cháy.`);
    });

    bot.on("polling_error", (error) => {
      console.error("Telegram Polling Error:", error.code);
    });
  } catch (err) {
    console.error("❌ Failed to initialize Telegram Bot:", err.message);
  }
} else {
  console.warn("⚠️ TELEGRAM_BOT_TOKEN is missing in .env. Telegram features will be disabled.");
}

/**
 * Send a message to a specific user via Telegram
 * @param {string} chatId - The user's Telegram Chat ID
 * @param {string} message - The message content
 */
exports.sendTelegramAlert = async (chatId, message) => {
  if (!bot) {
    console.warn("Cannot send Telegram message: Bot is not initialized.");
    return false;
  }

  try {
    await bot.sendMessage(chatId, message, { parse_mode: "HTML" });
    console.log(`🚀 Telegram sent to ${chatId}`);
    return true;
  } catch (err) {
    console.error(`❌ Telegram send error to ${chatId}:`, err.message);
    return false;
  }
};
