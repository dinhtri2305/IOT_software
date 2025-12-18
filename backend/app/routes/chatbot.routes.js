const express = require("express");
const router = express.Router();
const chatbotController = require("../controllers/chatbot.controller");
const { protect } = require("../middleware/auth.middleware");

// Tất cả routes đều yêu cầu authentication
router.use(protect);

// POST /api/chatbot/ask - Gửi câu hỏi
router.post("/ask", chatbotController.ask);

// POST /api/chatbot/reset - Reset lịch sử
router.post("/reset", chatbotController.reset);

// GET /api/chatbot/history - Lấy lịch sử
router.get("/history", chatbotController.getHistory);

module.exports = router;

