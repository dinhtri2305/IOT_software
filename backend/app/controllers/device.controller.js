const mqttHandler = require("../../utils/mqtt_handler");
const Device = require("../models/device.model");

// Reusable helper to send MQTT commands and update DB
const sendControlCommand = async (command, deviceId = "ESP32_001") => {
  const payload = {
    deviceId,
    timestamp: new Date().toISOString(),
    ...command,
  };

  const success = mqttHandler.publishControl(payload);

  if (success) {
    try {
      const device = await Device.findOneAndUpdate(
        { deviceId },
        {
          $set: {
            "relay.status": command.relay || undefined,
            "buzzer.status": command.buzzer || undefined,
            "led.status": command.led || undefined,
            lastSeen: new Date(),
          },
        },
        { new: true }
      );
      if (device) await device.save();
    } catch (err) {
      console.error("Update device status error:", err.message);
    }
  }

  return success;
};

exports.controlRelay = async (req, res) => {
  const { action, deviceId } = req.body;
  if (!["on", "off"].includes(action)) {
    return res
      .status(400)
      .json({ success: false, message: 'Action must be "on" or "off"' });
  }

  const success = await sendControlCommand({ relay: action }, deviceId);

  res.json({
    success,
    message: success ? `Relay turned ${action}` : "MQTT not connected",
    action: "relay",
    status: action,
    deviceId: deviceId || "ESP32_001",
  });
};

exports.controlBuzzer = async (req, res) => {
  const { action, deviceId } = req.body;
  if (!["on", "off"].includes(action)) {
    return res
      .status(400)
      .json({ success: false, message: 'Action must be "on" or "off"' });
  }

  const success = await sendControlCommand({ buzzer: action }, deviceId);

  res.json({
    success,
    message: success ? `Buzzer turned ${action}` : "MQTT not connected",
    action: "buzzer",
    status: action,
  });
};

exports.controlLED = async (req, res) => {
  const { action, deviceId } = req.body;
  if (!["on", "off", "blink"].includes(action)) {
    return res.status(400).json({
      success: false,
      message: 'Action must be "on", "off" or "blink"',
    });
  }

  const success = await sendControlCommand({ led: action }, deviceId);

  res.json({
    success,
    message: success ? `LED set to ${action}` : "MQTT not connected",
    action: "led",
    status: action,
  });
};

exports.controlAll = async (req, res) => {
  const { relay = "off", buzzer = "off", led = "off", deviceId } = req.body;

  const success = await sendControlCommand({ relay, buzzer, led }, deviceId);

  res.json({
    success,
    message: success ? "All actuators updated" : "MQTT not connected",
    command: { relay, buzzer, led },
  });
};

exports.emergencyStop = async (req, res) => {
  const { deviceId } = req.body;

  const success = await sendControlCommand(
    { relay: "off", buzzer: "off", led: "off", emergency: true },
    deviceId
  );

  res.json({
    success,
    message: success
      ? "EMERGENCY STOP ACTIVATED – ALL OFF"
      : "MQTT not connected",
    emergency: true,
  });
};

exports.testDevices = async (req, res) => {
  const { deviceId } = req.body;
  const success = await sendControlCommand({ test: true }, deviceId);
  res.json({
    success,
    message: success ? "Device test sequence started" : "MQTT not connected",
    description: "LED blink → Buzzer beep → Relay click",
  });
};

exports.getStatus = async (req, res) => {
  try {
    const devices = await Device.getAllStatus();
    res.json({
      success: true,
      mqttConnected: mqttHandler.isConnected(),
      totalDevices: devices.length,
      devices,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Failed to get device status",
      error: err.message,
    });
  }
};

exports.updateSettings = async (req, res) => {
  try {
    const { deviceId, autoMode, tempThreshold, gasThreshold } = req.body;
    const updateData = {};
    if (autoMode !== undefined) updateData.autoMode = autoMode;
    if (tempThreshold !== undefined) updateData.tempThreshold = tempThreshold;
    if (gasThreshold !== undefined) updateData.gasThreshold = gasThreshold;

    const device = await Device.findOneAndUpdate(
      { deviceId: deviceId || "ESP32_001" },
      updateData,
      { new: true }
    );

    res.json({
      success: true,
      message: "Settings updated",
      settings: updateData,
      deviceId: device.deviceId,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Update settings failed",
      error: err.message,
    });
  }
};

exports.heartbeat = async (req, res) => {
  try {
    const {
      deviceId,
      ipAddress,
      signalStrength,
      uptime,
      firmwareVersion,
      macAddress,
    } = req.body;
    await Device.heartbeat(deviceId || "ESP32_001", {
      ipAddress,
      signalStrength,
      uptime,
      firmwareVersion,
      macAddress,
    });
    res.json({
      success: true,
      message: "Heartbeat received",
      deviceId: deviceId || "ESP32_001",
      timestamp: new Date(),
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Heartbeat failed",
      error: err.message,
    });
  }
};

exports.rebootDevice = async (req, res) => {
  const { deviceId } = req.body;
  const success = await sendControlCommand({ reboot: true }, deviceId);
  res.json({
    success,
    message: success ? "Reboot command sent" : "MQTT not connected",
  });
};

module.exports = exports;
