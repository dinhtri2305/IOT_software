const mqtt = require("mqtt");
const SensorData = require("../app/models/sensor.model");
const Device = require("../app/models/device.model");

class MQTTHandler {
  constructor() {
    this.client = null;
    this.connected = false;
  }

  connect() {
    const options = {
      host: process.env.MQTT_BROKER || "broker.hivemq.com",
      port: process.env.MQTT_PORT || 1883,
      protocol: "mqtt",
      username: process.env.MQTT_USERNAME || "",
      password: process.env.MQTT_PASSWORD || "",
      clientId: `fire_detection_backend_${Math.random().toString(16).slice(3)}`,
      clean: true,
      reconnectPeriod: 5000,
      connectTimeout: 30 * 1000,
    };

    console.log("🔄 Connecting to MQTT Broker...");
    console.log(`📡 Broker: ${options.host}:${options.port}`);

    this.client = mqtt.connect(options);

    // Connection successful
    this.client.on("connect", () => {
      console.log("✅ MQTT Connected successfully!");
      this.connected = true;

      // Subscribe to sensor data topic
      this.client.subscribe(process.env.MQTT_TOPIC_SENSOR, (err) => {
        if (!err) {
          console.log(`📥 Subscribed to: ${process.env.MQTT_TOPIC_SENSOR}`);
        } else {
          console.error("❌ Subscription error:", err);
        }
      });

      // Subscribe to device status topic
      this.client.subscribe(process.env.MQTT_TOPIC_STATUS, (err) => {
        if (!err) {
          console.log(`📥 Subscribed to: ${process.env.MQTT_TOPIC_STATUS}`);
        }
      });
    });

    // Message received
    this.client.on("message", async (topic, message) => {
      try {
        const data = JSON.parse(message.toString());
        console.log(`📨 Received from ${topic}:`, data);

        // Handle sensor data
        if (topic === process.env.MQTT_TOPIC_SENSOR) {
          await this.handleSensorData(data);
        }

        // Handle device status
        if (topic === process.env.MQTT_TOPIC_STATUS) {
          await this.handleDeviceStatus(data);
        }
      } catch (error) {
        console.error("❌ Error processing message:", error);
      }
    });

    // Connection error
    this.client.on("error", (error) => {
      console.error("❌ MQTT Connection Error:", error.message);
      this.connected = false;
    });

    // Disconnected
    this.client.on("close", () => {
      console.log("🔌 MQTT Disconnected");
      this.connected = false;
    });

    // Reconnecting
    this.client.on("reconnect", () => {
      console.log("🔄 MQTT Reconnecting...");
    });
  }

  // Save sensor data to database
  async handleSensorData(data) {
    try {
      const sensorData = new SensorData({
        temperature: data.temperature,
        humidity: data.humidity,
        gasLevel: data.gasLevel,
        fireDetected: data.fireDetected,
        timestamp: new Date(),
      });

      await sensorData.save();
      console.log("💾 Sensor data saved to database");

      // Check for fire alert
      if (data.fireDetected) {
        console.log("🚨 FIRE ALERT DETECTED!");
        // TODO: Send notification, trigger actions
      }
    } catch (error) {
      console.error("❌ Error saving sensor data:", error);
    }
  }

  // Handle device status updates
  async handleDeviceStatus(data) {
    console.log("📊 Device status update:", data);
    // TODO: Update device status in database
  }

  // Publish control command to ESP32
  publishControl(command) {
    if (!this.connected) {
      console.error("❌ MQTT not connected, cannot publish");
      return false;
    }

    const message = JSON.stringify(command);
    this.client.publish(
      process.env.MQTT_TOPIC_CONTROL,
      message,
      { qos: 1 },
      (err) => {
        if (err) {
          console.error("❌ Publish error:", err);
        } else {
          console.log("📤 Control command sent:", command);
        }
      }
    );

    return true;
  }

  // Check connection status
  isConnected() {
    return this.connected;
  }

  // Disconnect
  disconnect() {
    if (this.client) {
      this.client.end();
      console.log("🔌 MQTT Disconnected gracefully");
    }
  }
}

// Export singleton instance
module.exports = new MQTTHandler();
