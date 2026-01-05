// backend/test-pub.js
/*
  SCRIPT TEST CHỨC NĂNG CẢNH BÁO CHÁY
  - Script này sẽ giả lập một tín hiệu từ ESP32 gửi lên MQTT.
  - Tín hiệu này chứa cờ fireDetected: true để kích hoạt gửi email.
*/

const mqtt = require("mqtt");

// Kết nối đến Broker giống như trong .env của bạn
// Nếu bạn dùng broker khác, hãy đổi URL ở đây
const BROKER_URL = "mqtt://broker.hivemq.com:1883"; 
const TOPIC = "fire/sensor/data";

console.log(`Connecting to ${BROKER_URL}...`);
const client = mqtt.connect(BROKER_URL);

client.on("connect", () => {
  console.log("✅ Connected to MQTT Broker");

  // Dữ liệu giả lập CHÁY
  const payload = JSON.stringify({
    deviceId: "ESP32_TEST_FIRE",  // ID thiết bị test
    temperature: 55.5,            // Nhiệt độ cao
    humidity: 15.0,               // Độ ẩm thấp
    gasLevel: 3500,               // Gas cao
    fireDetected: true,           // QUAN TRỌNG: Kích hoạt cảnh báo
    location: "Phòng Server (Test)",
    timestamp: new Date().toISOString()
  });

  client.publish(TOPIC, payload, { qos: 1 }, (err) => {
    if (err) {
        console.error("❌ Publish error:", err);
    } else {
        console.log(`🚀 SENT FIRE ALERT to topic "${TOPIC}":`);
        console.log(payload);
        console.log("\n--> Kiểm tra terminal backend xem có log 'Sending alerts...' không");
        console.log("--> Kiểm tra email của bạn (cả mục Spam)");
    }
    client.end();
  });
});

client.on("error", (err) => {
    console.error("Connection error:", err);
    client.end();
});
