require("dotenv").config();

// npm install groq-sdk
const Groq = require("groq-sdk");

// Bạn có thể đổi sang model khác nếu muốn
// Model này sử dụng miễn phí
const DEFAULT_MODEL = "openai/gpt-oss-120b";

// Khởi tạo Groq client một lần, dùng chung cho tất cả request
const apiKey = process.env.GROQ_API_KEY;
if (!apiKey) {
  throw new Error("GROQ_API_KEY không tồn tại trong .env");
}

// Khởi tạo model Groq
const groq = new Groq({ apiKey });

// Lưu trữ history cho mỗi user (userId -> messages[])
const userHistories = new Map();

// Lấy hoặc tạo history cho user
function getUserHistory(userId) {
  if (!userHistories.has(userId)) {
    userHistories.set(userId, []);
  }
  return userHistories.get(userId);
}

// POST /api/chatbot/ask - Gửi câu hỏi đến Groq
exports.ask = async (req, res) => {
  try {
    const { question } = req.body;
    const userId = req.user.id; // Từ auth middleware

    if (!question || typeof question !== "string" || !question.trim()) {
      return res.status(400).json({
        success: false,
        message: "Câu hỏi không được để trống",
      });
    }

    // Lấy history của user
    const history = getUserHistory(userId);

    // Tạo messages array: system message + history + câu hỏi mới
    const messages = [
      {
        role: "system",
        content: `
          Bạn là trợ lý AI thân thiện, trả lời ngắn gọn, rõ ràng bằng tiếng Việt.
          Bạn sẽ phải hỗ trợ người dùng về cách sử dụng thiết bị và website IoT.
          Bạn được phép đọc dữ liệu được gửi về từ thiết bị và website IoT để trả lời câu hỏi của người dùng.
        `,
      },
      ...history,
      {
        role: "user",
        content: question.trim(),
      },
    ];

    // Gọi Groq API với history
    const completion = await groq.chat.completions.create({
      model: DEFAULT_MODEL,
      messages: messages,
    });

    const text =
      completion.choices[0]?.message?.content?.trim() ||
      "Xin lỗi, tôi không tạo được câu trả lời.";

    // Lưu câu hỏi và câu trả lời vào history
    history.push({
      role: "user",
      content: question.trim(),
    });
    
    history.push({
      role: "assistant",
      content: text,
    });

    res.status(200).json({
      success: true,
      response: text,
    });
  } catch (error) {
    console.error("Chatbot ask error (Groq):", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi gọi Groq API",
      error: error.message,
    });
  }
};

// POST /api/chatbot/reset - Reset lịch sử chat
exports.reset = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Xóa history của user này
    userHistories.delete(userId);

    res.status(200).json({
      success: true,
      message: "Đã reset lịch sử chat",
    });
  } catch (error) {
    console.error("Chatbot reset error:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi reset lịch sử",
      error: error.message,
    });
  }
};

// GET /api/chatbot/history - Lấy lịch sử chat
exports.getHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const history = getUserHistory(userId);

    res.status(200).json({
      success: true,
      history: history,
    });
  } catch (error) {
    console.error("Chatbot getHistory error:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi lấy lịch sử",
      error: error.message,
    });
  }
};

