// backend/test-pub.js
const mqtt = require("mqtt");
const client = mqtt.connect("mqtt://broker.hivemq.com:1883");

client.on("connect", () => {
  const payload = JSON.stringify({
    deviceId: "ESP32_001",
    temperature: 28.5,
    humidity: 60,
    gasLevel: 120,
    firmwareVersion: "1.0.0",
  });
  client.publish("fire/sensor/data", payload, {}, () => {
    console.log("Test MQTT message sent");
    client.end();
  });
});
