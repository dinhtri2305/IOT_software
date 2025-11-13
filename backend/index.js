const express = require("express");
const app = express();
const PORT = 3000;

// Cho phép đọc JSON gửi từ ESP32
app.use(express.json());

// Route kiểm tra server
app.get("/", (req, res) => {
  res.send("🔥 Fire Alert Server is running!");
});

// Route nhận dữ liệu từ ESP32
app.post("/sensor", (req, res) => {
  const data = req.body;
  console.log("📡 Dữ liệu nhận từ ESP32:", data);
  res.json({ message: "Dữ liệu đã nhận", received: data });
});

// Chạy server
app.listen(PORT, () => {
  console.log(`✅ Server đang chạy tại http://localhost:${PORT}`);
});
