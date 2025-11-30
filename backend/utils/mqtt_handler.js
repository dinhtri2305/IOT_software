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
    const brokerUrl = `mqtt://${
      process.env.MQTT_BROKER || "broker.hivemq.com"
    }:${process.env.MQTT_PORT || 1883}`;
    const options = {
      clientId: `backend_${Date.now()}_${Math.random()
        .toString(16)
        .slice(2, 8)}`,
      clean: true,
      reconnectPeriod: 3000,
      connectTimeout: 10 * 1000,
      keepalive: 60,
      resubscribe: true,
      username: process.env.MQTT_USERNAME || undefined,
      password: process.env.MQTT_PASSWORD || undefined,
    };

    console.log("Connecting MQTT Broker:", brokerUrl);
    this.client = mqtt.connect(brokerUrl, options);

    this.client.on("connect", () => {
      this.connected = true;
      console.log("MQTT Connected!");

      const topics = [
        process.env.MQTT_TOPIC_SENSOR,
        process.env.MQTT_TOPIC_STATUS,
        process.env.MQTT_TOPIC_CONTROL, // để nhận lệnh từ frontend
      ].filter(Boolean);

      this.client.subscribe(topics, { qos: 1 }, (err) => {
        if (!err) {
          console.log("Subscribed to:", topics.join(", "));
        } else {
          console.error("Subscribe error:", err.message);
        }
      });
    });

    this.client.on("message", async (topic, message) => {
      let payload;
      try {
        payload = JSON.parse(message.toString());
      } catch (err) {
        console.warn("Invalid JSON received on", topic, message.toString());
        return;
      }

      console.log(`Message from ${topic}:`, payload);

      try {
        if (topic === process.env.MQTT_TOPIC_SENSOR) {
          await this.handleSensorData(payload);
        } else if (topic === process.env.MQTT_TOPIC_STATUS) {
          await this.handleDeviceStatus(payload);
        } else if (topic === process.env.MQTT_TOPIC_CONTROL) {
          // Nhận lệnh từ frontend → forward lại cho ESP32
          this.publishControl(payload);
        }
      } catch (err) {
        console.error("Handler error:", err);
      }
    });

    this.client.on("error", (err) => {
      console.error("MQTT Error:", err.message);
      this.connected = false;
    });

    this.client.on("offline", () => {
      console.warn("MQTT Offline");
      this.connected = false;
    });

    this.client.on("reconnect", () => {
      console.log("MQTT Reconnecting...");
    });

    this.client.on("close", () => {
      if (this.connected) {
        console.log("MQTT Connection closed");
        this.connected = false;
      }
    });
  }

  // Xử lý dữ liệu cảm biến
  async handleSensorData(data) {
    if (!data || typeof data !== "object") return;

    try {
      const sensor = new SensorData({
        deviceId: data.deviceId || "unknown",
        temperature: data.temperature ?? null,
        humidity: data.humidity ?? null,
        gasLevel: data.gasLevel ?? null,
        fireDetected: Boolean(data.fireDetected),
        location: data.location || "Unknown",
        timestamp: data.timestamp ? new Date(data.timestamp) : new Date(),
      });

      await sensor.save();
      console.log("Sensor data saved");

      if (sensor.fireDetected) {
        console.log("FIRE ALERT FROM", sensor.deviceId || "unknown device");
        // TODO: Gửi Telegram, Push Notification, Email...
      }
    } catch (err) {
      console.error("Save sensor error:", err.message);
    }
  }

  // Xử lý trạng thái thiết bị (heartbeat)
  async handleDeviceStatus(data) {
    if (!data?.deviceId) return;

    try {
      await Device.heartbeat(data.deviceId, {
        ipAddress: data.ipAddress,
        signalStrength: data.signalStrength,
        uptime: data.uptime,
        firmwareVersion: data.firmwareVersion,
      });
      console.log(`Device ${data.deviceId} heartbeat OK`);
    } catch (err) {
      console.error("Heartbeat error:", err.message);
    }
  }

  // Gửi lệnh điều khiển (relay, buzzer, led)
  publishControl(command) {
    if (!this.connected || !this.client) {
      console.error("MQTT not connected – cannot send control");
      return false;
    }

    const topic = process.env.MQTT_TOPIC_CONTROL;
    const message = JSON.stringify(command);

    this.client.publish(topic, message, { qos: 1 }, (err) => {
      if (err) {
        console.error("Publish failed:", err.message);
      } else {
        console.log("Control sent:", command);
      }
    });

    return true;
  }

  // Trạng thái kết nối
  isConnected() {
    return this.connected && this.client?.connected;
  }

  // Ngắt kết nối sạch sẽ
  disconnect() {
    if (this.client) {
      this.client.end(false, () => {
        console.log("MQTT disconnected gracefully");
      });
      this.connected = false;
    }
  }
}

// Export singleton
module.exports = new MQTTHandler();
