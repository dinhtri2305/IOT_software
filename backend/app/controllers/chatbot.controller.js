require("dotenv").config();

// npm install groq-sdk
const Groq = require("groq-sdk");
const Device = require("../models/device.model");
const SensorData = require("../models/sensor.model");
const ChatHistory = require("../models/chatHistory.model");

const DEFAULT_MODEL = "openai/gpt-oss-120b";

// Khởi tạo Groq client một lần, dùng chung cho tất cả request
const apiKey = process.env.GROQ_API_KEY;
if (!apiKey) {
  throw new Error("GROQ_API_KEY không tồn tại trong .env");
}

// Khởi tạo model Groq
const groq = new Groq({ apiKey });

// Hàm lấy hoặc tạo chat history cho user
async function getUserHistory(userId) {
  try {
    let chatHistory = await ChatHistory.findOne({ userId });
    
    if (!chatHistory) {
      chatHistory = new ChatHistory({
        userId,
        messages: [],
      });
      await chatHistory.save();
    }
    
    // Remove _id từ mỗi message vì Groq API không chấp nhận
    return chatHistory.messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));
  } catch (error) {
    console.error("Lỗi khi lấy history:", error);
    return [];
  }
}

// Hàm lấy dữ liệu sensor và device hiện tại
async function getDeviceContext() {
  try {
    // Lấy tất cả devices
    const devices = await Device.find({}).lean();
    
    // Lấy dữ liệu sensor mới nhất của mỗi device
    const deviceContexts = [];
    
    for (const device of devices) {
      const latestSensorData = await SensorData.findOne({
        deviceId: device.deviceId,
      })
        .sort({ createdAt: -1 })
        .lean();

      const context = {
        deviceId: device.deviceId,
        deviceName: device.deviceName,
        location: device.location,
        isOnline: device.isOnline,
        status: {
          relay: (device.relay?.status || "OFF").toUpperCase(),
          buzzer: (device.buzzer?.status || "OFF").toUpperCase(),
          led: (device.led?.status || "OFF").toUpperCase(),
        },
        threshold: {
          temperature: device.tempThreshold,
          gas: device.gasThreshold,
          humidityLow: device.humidityLowThreshold,
        },
        latestSensorData: latestSensorData
          ? {
              temperature: latestSensorData.temperature,
              humidity: latestSensorData.humidity,
              gasLevel: latestSensorData.gasLevel,
              ldrValue: latestSensorData.ldrValue,
              lightLed: latestSensorData.lightLed,
              fireDetected: latestSensorData.fireDetected,
              timestamp: latestSensorData.createdAt,
            }
          : null,
      };

      deviceContexts.push(context);
    }

    return deviceContexts;
  } catch (error) {
    console.error("Lỗi khi lấy device context:", error);
    return [];
  }
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

    // Lấy dữ liệu device và sensor hiện tại
    const deviceContexts = await getDeviceContext();

    // Format dữ liệu để dễ đọc
    const contextString = deviceContexts
      .map((device) => {
        let deviceInfo = `Thiết bị: ${device.deviceName} (${device.deviceId})\n`;
        deviceInfo += `   Vị trí: ${device.location}\n`;
        deviceInfo += `   Trạng thái: ${device.isOnline ? "Online" : "Offline"}\n`;
        deviceInfo += `   Relay: ${device.status.relay}, Buzzer: ${device.status.buzzer}, LED: ${device.status.led}\n`;

        if (device.latestSensorData) {
          deviceInfo += `   Dữ liệu cảm biến (cập nhật lúc ${new Date(device.latestSensorData.timestamp).toLocaleString("vi-VN")}):\n`;
          deviceInfo += `      - Nhiệt độ: ${device.latestSensorData.temperature}°C (ngưỡng: ${device.threshold.temperature}°C)\n`;
          deviceInfo += `      - Độ ẩm: ${device.latestSensorData.humidity}% (ngưỡng tối thiểu: ${device.threshold.humidityLow}%)\n`;
          deviceInfo += `      - Mức khí: ${device.latestSensorData.gasLevel} (ngưỡng: ${device.threshold.gas})\n`;
          deviceInfo += `      - Ánh sáng (LDR): ${device.latestSensorData.ldrValue}\n`;
          deviceInfo += `      - LED: ${device.latestSensorData.lightLed}\n`;
          deviceInfo += `      - Phát hiện lửa: ${device.latestSensorData.fireDetected ? "CÓ" : "KHÔNG"}\n`;
        } else {
          deviceInfo += `   Chưa có dữ liệu cảm biến\n`;
        }

        return deviceInfo;
      })
      .join("\n");

    // Lấy history của user
    const history = await getUserHistory(userId);

    // Tạo messages array: system message + history + câu hỏi mới
    const messages = [
      {
        role: "system",
        content: `
          Bạn là trợ lý AI thân thiện của hệ thống IoT Fire Forecast, trả lời ngắn gọn, rõ ràng bằng tiếng Việt.
          
          DỮ LIỆU HỆ THỐNG HIỆN TẠI:
          ${contextString}
          
          HƯỚNG DẪN:
          - Bạn hỗ trợ người dùng về cách sử dụng thiết bị và website IoT.
          - Đọc và phân tích dữ liệu cảm biến được cung cấp để trả lời câu hỏi.
          - Khi người dùng hỏi về trạng thái: chỉ ra nhiệt độ, độ ẩm, mức khí hiện tại.
          - Khi người dùng hỏi về cảnh báo: kiểm tra xem các giá trị có vượt ngưỡng không.
          - Nếu phát hiện lửa (fireDetected = true) hoặc giá trị cảm biến bất thường, báo ngay.
          - Trả lời chi tiết nhưng ngắn gọn, dễ hiểu.
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

    // Lưu câu hỏi và câu trả lời vào database
    const chatHistory = await ChatHistory.findOne({ userId });
    if (chatHistory) {
      chatHistory.messages.push({
        role: "user",
        content: question.trim(),
      });
      chatHistory.messages.push({
        role: "assistant",
        content: text,
      });
      await chatHistory.save();
    }

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
    
    // Xóa messages từ database
    await ChatHistory.updateOne({ userId }, { messages: [] });

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
    const history = await getUserHistory(userId);

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

