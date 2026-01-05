// utils/mqtt_handler.js
const mqtt = require("mqtt");
const SensorData = require("../app/models/sensor.model");
const Device = require("../app/models/device.model");
const User = require("../app/models/user.model");
const sendEmail = require("./sendEmail");

class MQTTHandler {
  constructor() {
    this.client = null;
    this.connected = false;
    this.messageCount = 0; // Counter for received messages
    this.fireAlertCooldowns = new Map(); // Store last alert time per device
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
      console.log(`\n MQTT Message received on topic: "${topic}"`);
      console.log(` Expected topics:`, {
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
          console.warn(
            `   Expected: ${process.env.MQTT_TOPIC_SENSOR} or ${process.env.MQTT_TOPIC_STATUS}`
          );
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
        const now = Date.now();
        const lastAlert = this.fireAlertCooldowns.get(sensor.deviceId);
        //const COOLDOWN_MS = 15 * 60 * 1000; // 15 minutes
        const COOLDOWN_MS = 30 * 1000;

        if (!lastAlert || now - lastAlert > COOLDOWN_MS) {
          console.log(
            `🔥 FIRE DETECTED on ${sensor.deviceId}. Sending alerts...`
          );
          this.sendGlobalFireAlert(sensor);
          this.fireAlertCooldowns.set(sensor.deviceId, now);
        } else {
          console.log(
            `🔥 Fire on ${sensor.deviceId} - In cooldown (${Math.round(
              (COOLDOWN_MS - (now - lastAlert)) / 1000
            )}s remaining)`
          );
        }
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
          updates["led.status"] =
            data.led === "on" ? "on" : data.led === "blink" ? "blink" : "off";
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

  // Broadcast fire alert to all users
  async sendGlobalFireAlert(sensor) {
    try {
      // 1. Get all registered users with their notification settings
      const users = await User.find({}).select(
        "email name telegramChatId notificationPreference"
      );
      if (!users.length) return;

      console.log(`Checking alert preferences for ${users.length} users...`);

      // 2. Prepare Notification Content
      const timeString = new Date(sensor.timestamp).toLocaleString("vi-VN");
      const googleMapsLink = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        sensor.location
      )}`;

      // --- HTML Content for Email ---
      const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
          <div style="background-color: #d32f2f; color: white; padding: 20px; text-align: center;">
            <h1 style="margin: 0; font-size: 24px;">🔥 CẢNH BÁO CHÁY! 🔥</h1>
            <p style="margin: 5px 0 0;">Phát hiện nguy hiểm tại khu vực giám sát</p>
          </div>
          
          <div style="padding: 20px;">
            <p>Hệ thống IoT đã nhận tín hiệu cảnh báo cháy từ thiết bị <strong>${sensor.deviceId}</strong>.</p>
            
            <div style="background-color: #fff3e0; border-left: 4px solid #ff9800; padding: 15px; margin: 20px 0;">
              <p style="margin: 5px 0;"><strong>🕒 Thời gian:</strong> ${timeString}</p>
              <p style="margin: 5px 0;"><strong>📍 Vị trí:</strong> ${sensor.location}</p>
              <p style="margin: 5px 0;"><strong>🌡️ Nhiệt độ:</strong> ${sensor.temperature}°C</p>
              <p style="margin: 5px 0;"><strong>💧 Độ ẩm:</strong> ${sensor.humidity}%</p>
              <p style="margin: 5px 0;"><strong>⚠️ Mức Gas:</strong> ${sensor.gasLevel}</p>
            </div>
            <p><a href="${googleMapsLink}">Xem vị trí trên bản đồ</a></p>
          </div>
        </div>
      `;

      // --- Plain Text Content for Telegram ---
      const telegramMessage = `
🔥 <b>CẢNH BÁO CHÁY!</b> 🔥
<b>Phát hiện nguy hiểm tại khu vực giám sát</b>

🕒 <b>Thời gian:</b> ${timeString}

📍 <b>Vị trí:</b> ${sensor.location}

🌡️ <b>Nhiệt độ:</b> ${sensor.temperature}°C

💧 <b>Độ ẩm:</b> ${sensor.humidity}%

⚠️ <b>Mức Gas:</b> ${sensor.gasLevel}
`;

      // 3. Send Notifications based on Preference
      const telegramBot = require("./telegramBot");

      // --- DEMO OVERRIDE (Send Once) ---
      // Read from .env so code is clean and team members can set their own ID
      const demoChatId = process.env.DEMO_CHAT_ID;
      if (demoChatId) {
        telegramBot
          .sendTelegramAlert(demoChatId, telegramMessage)
          .then(() =>
            console.log(`🔔 (Demo) Sent Telegram to ID: ${demoChatId}`)
          )
          .catch((e) => console.error("Telegram Error:", e.message));
      }

      for (const user of users) {
        // 1. ALWAYS SEND EMAIL (Official record)
        sendEmail({
          to: user.email,
          subject: `🔥 CẢNH BÁO CHÁY KHẨN CẤP - ${sensor.deviceId}`,
          html: htmlContent,
        })
          .then(() =>
            console.log(
              `📧 Sent Email alert to user: ${user.name} (${user.email})`
            )
          )
          .catch((err) =>
            console.error(
              `❌ Failed to send email to ${user.email}:`,
              err.message
            )
          );

        // 2. SEND TELEGRAM IF AVAILABLE (Instant alert)
        // --- REAL USER LOGIC ---
        // Only send if the user has a ChatID AND it's different from the demo ID (to avoid double send if you are also in the DB)
        if (user.telegramChatId && user.telegramChatId !== demoChatId) {
          telegramBot
            .sendTelegramAlert(user.telegramChatId, telegramMessage)
            .then(() =>
              console.log(`🔔 Sent Telegram alert to user: ${user.name}`)
            );
        }
      }
    } catch (err) {
      console.error("Error sending global fire alert:", err);
    }
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
