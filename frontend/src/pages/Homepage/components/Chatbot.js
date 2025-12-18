import React, { useState, useRef, useEffect } from "react";
import axios from "axios";
import "./Chatbot.css";

// Thay đổi URL này nếu backend của bạn chạy ở host/port khác
const API_BASE_URL = "http://localhost:3000";

// Hàm format text để hiển thị markdown đơn giản
const formatMessage = (text) => {
  if (!text) return "";
  
  // Tách thành các dòng để xử lý list
  const lines = text.split('\n');
  let formatted = '';
  let inList = false;
  
  lines.forEach((line, index) => {
    const trimmedLine = line.trim();
    let processedLine = line;
    
    // Xử lý list items: - hoặc * hoặc số.
    const listMatch = trimmedLine.match(/^[-*]\s+(.+)$/) || trimmedLine.match(/^\d+\.\s+(.+)$/);
    
    if (listMatch) {
      if (!inList) {
        formatted += '<ul>';
        inList = true;
      }
      processedLine = listMatch[1];
    } else {
      if (inList) {
        formatted += '</ul>';
        inList = false;
      }
      processedLine = trimmedLine;
    }
    
    // Xử lý markdown trong dòng (thứ tự quan trọng: code trước, sau đó bold, cuối cùng italic)
    processedLine = processedLine
      // Code: `code` (xử lý trước để tránh conflict)
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      // Bold: **text** hoặc __text__
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/__([^_]+)__/g, '<strong>$1</strong>')
      // Italic: *text* (sau khi đã xử lý bold)
      .replace(/\*([^*]+)\*/g, '<em>$1</em>');
    
    if (listMatch) {
      formatted += `<li>${processedLine}</li>`;
    } else if (trimmedLine) {
      formatted += processedLine;
      if (index < lines.length - 1) {
        formatted += '<br>';
      }
    } else if (index < lines.length - 1) {
      formatted += '<br>';
    }
  });
  
  if (inList) {
    formatted += '</ul>';
  }
  
  return formatted;
};

const ChatbotComponent = ({ isOpen, onClose }) => {
  const [messages, setMessages] = useState([]); // { role: "user" | "assistant", content: string }[]
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  // Tự động scroll xuống cuối mỗi khi có tin nhắn mới
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isLoading]);

  const handleSend = async () => {
    const question = inputValue.trim();
    if (!question || isLoading) return;

    // Thêm tin nhắn user vào khung chat
    setMessages((prev) => [...prev, { role: "user", content: question }]);
    setInputValue("");
    setIsLoading(true);

    try {
      const token =
        localStorage.getItem("token") || sessionStorage.getItem("token");

      const headers = {
        "Content-Type": "application/json",
      };
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const response = await axios.post(
        `${API_BASE_URL}/api/chatbot/ask`,
        { question },
        {
          headers,
        }
      );

      const botReply =
        response?.data?.response ||
        "Xin lỗi, tôi không nhận được câu trả lời từ server.";

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: botReply },
      ]);
    } catch (err) {
      console.error("Lỗi khi gọi API chatbot:", err);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "Xin lỗi, tôi không thể trả lời lúc này. Vui lòng thử lại sau.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleReset = async () => {
    try {
      const token =
        localStorage.getItem("token") || sessionStorage.getItem("token");

      const headers = {
        "Content-Type": "application/json",
      };
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      // Gọi API reset ở backend
      await axios.post(
        `${API_BASE_URL}/api/chatbot/reset`,
        {},
        {
          headers,
        }
      );
    } catch (err) {
      console.error("Lỗi khi reset chatbot:", err);
    }

    // Xóa messages ở frontend (kể cả thành công hay thất bại)
    setMessages([]);
    setInputValue("");
  };

  if (!isOpen) return null;

  return (
    <div className="chatbot-overlay" onClick={onClose}>
      <div
        className="chatbot-container"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="chatbot-header">
          <div className="chatbot-header-left">
            <img
              src="/assets/robot-assistant.png"
              alt="Chatbot"
              className="chatbot-header-icon"
            />
            <h3>TRỢ LÝ ẢO GROQ</h3>
          </div>
          <div className="chatbot-header-right">
            <button
              className="chatbot-reset-btn"
              onClick={handleReset}
              title="Xóa lịch sử"
            >
              <img 
               width={20}
               height={20}
               src="/assets/trash.png" 
               alt="Xóa lịch sử" 
              />
            </button>
            <button className="chatbot-close-btn" onClick={onClose}>
              ✕
            </button>
          </div>
        </div>

        <div className="chatbot-messages">
          {messages.length === 0 && (
            <div className="chatbot-welcome">
              <p>
                Xin chào! Tôi là trợ lý ảo Groq. Bạn có thể hỏi tôi về hệ
                thống IoT, cảm biến, thiết bị hoặc bất kỳ điều gì liên quan.
              </p>
            </div>
          )}

          {messages.map((msg, index) => (
            <div
              key={index}
              className={`chatbot-message ${
                msg.role === "user"
                  ? "chatbot-message-user"
                  : "chatbot-message-assistant"
              }`}
            >
              <div 
                className="chatbot-message-content"
                dangerouslySetInnerHTML={{ __html: formatMessage(msg.content) }}
              />
            </div>
          ))}

          {isLoading && (
            <div className="chatbot-message chatbot-message-assistant">
              <div className="chatbot-message-content chatbot-loading">
                <span>●</span>
                <span>●</span>
                <span>●</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        <div className="chatbot-input-container">
          <textarea
            className="chatbot-input"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Nhập câu hỏi của bạn..."
            rows="1"
            disabled={isLoading}
          />
          <button
            className="chatbot-send-btn"
            onClick={handleSend}
            disabled={!inputValue.trim() || isLoading}
          >
            ➤
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatbotComponent;