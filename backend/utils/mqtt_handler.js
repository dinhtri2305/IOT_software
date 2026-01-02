// utils/mqtt_handler.js
const mqtt = require("mqtt");
const SensorData = require("../app/models/sensor.model");
const Device = require("../app/models/device.model");

class MQTTHandler {
  constructor() {
    this.client = null;
    this.connected = false;
    this.messageCount = 0; // Counter for received messages
  }

  connect() {
    const brokerUrl = `mqtt://${process.env.MQTT_BROKER || "broker.hivemq.com"
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
        // Backend không subscribe CONTROL topic - chỉ publish
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
      console.log(`\n📨 MQTT Message received on topic: "${topic}"`);
      console.log(`📋 Expected topics:`, {
        sensor: process.env.MQTT_TOPIC_SENSOR,
        status: process.env.MQTT_TOPIC_STATUS,
        control: process.env.MQTT_TOPIC_CONTROL,
      });
      
      let payload;
      try {
        payload = JSON.parse(message.toString());
        console.log(`Parsed payload:`, JSON.stringify(payload, null, 2));
      } catch (err) {
        console.warn("Invalid JSON received on", topic, message.toString());
        return;
      }

      // Increment counter for sensor data
      if (topic === process.env.MQTT_TOPIC_SENSOR) {
        this.messageCount++;
        console.log(`\n\n========== COUNT: ${this.messageCount} ==========`);
      }

      try {
        if (topic === process.env.MQTT_TOPIC_SENSOR) {
          await this.handleSensorData(payload);
        } else if (topic === process.env.MQTT_TOPIC_STATUS) {
          console.log(`Processing device status from topic: ${topic}`);
          await this.handleDeviceStatus(payload);
        } else {
          console.warn(`Unknown topic received: ${topic}`);
          console.warn(`   Expected: ${process.env.MQTT_TOPIC_SENSOR} or ${process.env.MQTT_TOPIC_STATUS}`);
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
      // Normalize timestamp: fallback to current time if missing/invalid/too old
      let timestamp = new Date();
      if (data.timestamp !== undefined && data.timestamp !== null) {
        const candidate = new Date(data.timestamp);
        const year2000 = new Date("2000-01-01T00:00:00Z");
        if (!Number.isNaN(candidate.getTime()) && candidate > year2000) {
          timestamp = candidate;
        }
      }

      const sensor = new SensorData({
        deviceId: data.deviceId || "unknown",
        temperature: data.temperature ?? null,
        humidity: data.humidity ?? null,
        // accept gasLevel or gasVoltage (fallback)
        gasLevel:
          data.gasLevel !== undefined
            ? data.gasLevel
            : data.gasVoltage !== undefined
              ? data.gasVoltage
              : null,
        ldrValue: data.ldrValue ?? null,
        lightLed: data.lightLed || null,
        fireDetected: Boolean(data.fireDetected),
        location: data.location || "Unknown",
        timestamp,
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

  // Xử lý trạng thái thiết bị (heartbeat + actuator status)
  async handleDeviceStatus(data) {
    if (!data?.deviceId) return;

    try {
      // Cập nhật heartbeat
      await Device.heartbeat(data.deviceId, {
        ipAddress: data.ipAddress,
        signalStrength: data.signalStrength,
        uptime: data.uptime,
        firmwareVersion: data.firmwareVersion,
      });

      //Cập nhật trạng thái relay/buzzer/led nếu có
      const device = await Device.findOne({ deviceId: data.deviceId });
      if (device) {
        const updates = {};
        if (data.relay !== undefined) {
          updates["relay.status"] = data.relay === "on" ? "on" : "off";
          updates["relay.lastChanged"] = new Date();
        }
        if (data.buzzer !== undefined) {
          updates["buzzer.status"] = data.buzzer === "on" ? "on" : "off";
          updates["buzzer.lastChanged"] = new Date();
        }
        if (data.led !== undefined) {
          updates["led.status"] = data.led === "on" ? "on" : data.led === "blink" ? "blink" : "off";
          updates["led.lastChanged"] = new Date();
        }

        if (Object.keys(updates).length > 0) {
          updates["lastSeen"] = new Date();
          const updated = await Device.findOneAndUpdate(
            { deviceId: data.deviceId },
            { $set: updates },
            { new: true }
          );
          console.log(`Device ${data.deviceId} status updated:`, updates);
          console.log(`Current device state:`, {
            relay: updated.relay?.status,
            buzzer: updated.buzzer?.status,
            led: updated.led?.status,
          });
        } else {
          console.log(`No status updates needed for device ${data.deviceId}`);
        }
      }

      console.log(`Device ${data.deviceId} heartbeat OK`);
    } catch (err) {
      console.error("Heartbeat error:", err.message);
    }
  }

  // Gửi lệnh điều khiển (relay, buzzer, led)
  publishControl(command) {
    if (!this.connected || !this.client) {
      console.error("MQTT not connected, cannot send control");
      return false;
    }

    const topic = process.env.MQTT_TOPIC_CONTROL;
    const message = JSON.stringify(command);

    this.client.publish(topic, message, { qos: 1 }, (err) => {
      if (err) {
        console.error("Publish failed:", err.message);
      }
    });

    return true;
  }

  // Gửi riêng message cho LCD lên topic riêng
  publishLCD(command) {
    if (!this.connected || !this.client) {
      console.error("MQTT not connected – cannot send LCD message");
      return false;
    }

    const topic = process.env.MQTT_TOPIC_LCD || "fire/device/lcd";
    const message = JSON.stringify(command);

    this.client.publish(topic, message, { qos: 1 }, (err) => {
      if (err) {
        console.error("Publish LCD failed:", err.message);
      }
    });

    console.log(`Published LCD to ${topic}: ${message}`);
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
