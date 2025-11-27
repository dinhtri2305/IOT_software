// mqtt.config.js
// Central MQTT configuration and topic constants.
// This module reads from environment variables and provides
// helper values for mqtt connections and topic names.

const DEFAULT_BROKER = process.env.MQTT_BROKER || "mqtt://broker.hivemq.com";
const DEFAULT_PORT = Number(process.env.MQTT_PORT) || 1883;

const TOPICS = {
  SENSOR: process.env.MQTT_TOPIC_SENSOR || "fire/sensor/data",
  CONTROL: process.env.MQTT_TOPIC_CONTROL || "fire/device/control",
  STATUS: process.env.MQTT_TOPIC_STATUS || "fire/device/status",
};

function getConnectOptions() {
  return {
    host: DEFAULT_BROKER,
    port: DEFAULT_PORT,
    username: process.env.MQTT_USERNAME || undefined,
    password: process.env.MQTT_PASSWORD || undefined,
    clientId:
      process.env.MQTT_CLIENT_ID ||
      `fire_backend_${Math.random().toString(16).slice(2)}`,
    clean: true,
    reconnectPeriod: 5000,
    connectTimeout: 30 * 1000,
  };
}

module.exports = {
  brokerUrl: DEFAULT_BROKER,
  port: DEFAULT_PORT,
  topics: TOPICS,
  getConnectOptions,
};
