// utils/mqtt_handler.js
const mqtt = require("mqtt");
const SensorData = require("../app/models/sensor.model");
const Device = require("../app/models/device.model");

class MQTTHandler {
  constructor() {
    this.client = null;
    this.connected = false;
  }

  connect() {
    const brokerURL =
      process.env.MQTT_URL ||
      `mqtt://${process.env.MQTT_BROKER || "broker.hivemq.com"}:${
        process.env.MQTT_PORT || 1883
      }`;

    const options = {
      clientId: `fire_detection_backend_${Math.random().toString(16).slice(3)}`,
      username: process.env.MQTT_USERNAME || undefined,
      password: process.env.MQTT_PASSWORD || undefined,
      reconnectPeriod: 3000,
      connectTimeout: 10000,
      clean: true,
      keepalive: 60,
    };

    console.log("Connecting to MQTT Broker...");
    console.log(`Broker: ${brokerURL}`);

    this.client = mqtt.connect(brokerURL, options);

    this.client.on("connect", () => {
      this.connected = true;
      console.log("MQTT Connected successfully!");

      // Subscribe tất cả topic cần thiết
      this.subscribeTopic(process.env.MQTT_TOPIC_SENSOR, "sensor data");
      this.subscribeTopic(process.env.MQTT_TOPIC_STATUS, "device status");
      this.subscribeTopic(process.env.MQTT_TOPIC_CONTROL, "control commands"); // THÊM ĐỂ NHẬN LỆNH TỪ FRONTEND
    });

    this.client.on("message", async (topic, message) => {
      let data;
      try {
        data = JSON.parse(message.toString());
      } catch (e) {
        console.error(
          "Invalid JSON received on topic",
          topic,
          message.toString()
        );
        return;
      }

      console.log(`Message from ${topic}:`, data);

      if (topic === process.env.MQTT_TOPIC_SENSOR) {
        await this.handleSensorData(data);
      } else if (topic === process.env.MQTT_TOPIC_STATUS) {
        await this.handleDeviceStatus(data);
      } else if (topic === process.env.MQTT_TOPIC_CONTROL) {
        await this.handleControlCommand(data); // XỬ LÝ LỆNH TỪ FRONTEND/POSTMAN
      }
    });

    this.client.on("error", (err) => {
      console.error("MQTT Error:", err.message);
      this.connected = false;
    });

    this.client.on("close", () => {
      console.log("MQTT Connection closed");
      this.connected = false;
    });

    this.client.on("offline", () => {
      console.log("MQTT Client offline");
      this.connected = false;
    });

    this.client.on("reconnect", () => {
      console.log("MQTT Reconnecting...");
    });
  }

  subscribeTopic(topic, label) {
    if (!topic) {
      console.error(`Cannot subscribe ${label} – Topic missing in .env`);
      return;
    }
    this.client.subscribe(topic, { qos: 1 }, (err) => {
      if (err) {
        console.error(`Failed to subscribe ${label} (${topic}):`, err.message);
      } else {
        console.log(`Subscribed to ${label} → ${topic}`);
      }
    });
  }

  // Lưu dữ liệu cảm biến + cảnh báo cháy
  async handleSensorData(data) {
    try {
      const payload = {
        deviceId: data.deviceId || "unknown",
        temperature: data.temperature ?? null,
        humidity: data.humidity ?? null,
        gasLevel: data.gasLevel ?? null,
        flameDetected: data.flameDetected ?? null,
        fireDetected: data.fireDetected ?? false,
        timestamp: new Date(),
      };

      const saved = await SensorData.create(payload);
      console.log("Sensor data saved:", saved._id);

      // CẢNH BÁO CHÁY
      if (payload.fireDetected) {
        console.log("FIRE ALERT FROM DEVICE:", payload.deviceId);
        // Ở đây bạn có thể thêm: gửi push notification, gọi API Telegram, bật còi, v.v.
      }
    } catch (err) {
      console.error("Error saving sensor data:", err.message);
    }
  }

  // Cập nhật trạng thái thiết bị
  async handleDeviceStatus(data) {
    try {
      await Device.findOneAndUpdate(
        { deviceId: data.deviceId },
        {
          status: data.status || "online",
          lastOnline: new Date(),
          ip: data.ip || null,
        },
        { upsert: true, new: true }
      );
      console.log(`Device ${data.deviceId} status updated`);
    } catch (err) {
      console.error("Error updating device status:", err.message);
    }
  }

  // Xử lý lệnh điều khiển từ frontend/Postman
  async handleControlCommand(data) {
    try {
      console.log("Control command received:", data);

      // Forward lệnh xuống ESP32 ngay lập tức
      this.publishControl({
        action: data.action, // ví dụ: "activate_relay", "deactivate_relay", "silence_buzzer"
        value: data.value,
        deviceId: data.deviceId || "all",
        timestamp: new Date(),
      });
    } catch (err) {
      console.error("Control command handling error:", err);
    }
  }

  // Gửi lệnh điều khiển xuống ESP32
  publishControl(command) {
    if (!this.client || !this.connected) {
      console.warn("MQTT not connected – cannot publish control command");
      return false;
    }

    const topic = process.env.MQTT_TOPIC_CONTROL;
    if (!topic) {
      console.error("MQTT_TOPIC_CONTROL not defined in .env");
      return false;
    }

    const payload = JSON.stringify(command);
    this.client.publish(topic, payload, { qos: 1 }, (err) => {
      if (err) {
        console.error("Publish control failed:", err.message);
      } else {
        console.log("Control command sent:", command);
      }
    });
    return true;
  }

  isConnected() {
    return this.connected;
  }

  disconnect() {
    if (this.client) {
      this.client.end(false, () => {
        console.log("MQTT disconnected gracefully");
      });
      this.connected = false;
    }
  }
}

module.exports = new MQTTHandler();
