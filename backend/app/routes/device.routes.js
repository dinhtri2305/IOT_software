const mqttHandler = require("../../utils/mqtt_handler");
const Device = require("../models/device.model");

// Control relay (water spray)
exports.controlRelay = async (req, res) => {
  try {
    const { action } = req.body; // 'on' or 'off'

    if (!["on", "off"].includes(action)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid action. Use "on" or "off"',
      });
    }

    const command = {
      device: "relay",
      action: action,
      timestamp: new Date().toISOString(),
    };

    const success = mqttHandler.publishControl(command);

    if (success) {
      // Update device status in database
      const device = await Device.getDefaultDevice();
      await device.updateStatus({ relay: action });

      res.json({
        success: true,
        message: `Relay turned ${action}`,
        command: command,
      });
    } else {
      res.status(503).json({
        success: false,
        message: "MQTT not connected, cannot send command",
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error controlling relay",
      error: error.message,
    });
  }
};

// Control buzzer
exports.controlBuzzer = async (req, res) => {
  try {
    const { action } = req.body; // 'on' or 'off'

    if (!["on", "off"].includes(action)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid action. Use "on" or "off"',
      });
    }

    const command = {
      device: "buzzer",
      action: action,
      timestamp: new Date().toISOString(),
    };

    const success = mqttHandler.publishControl(command);

    if (success) {
      // Update device status in database
      const device = await Device.getDefaultDevice();
      await device.updateStatus({ buzzer: action });

      res.json({
        success: true,
        message: `Buzzer turned ${action}`,
        command: command,
      });
    } else {
      res.status(503).json({
        success: false,
        message: "MQTT not connected, cannot send command",
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error controlling buzzer",
      error: error.message,
    });
  }
};

// Control LED
exports.controlLED = async (req, res) => {
  try {
    const { action } = req.body; // 'on', 'off', or 'blink'

    if (!["on", "off", "blink"].includes(action)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid action. Use "on", "off", or "blink"',
      });
    }

    const command = {
      device: "led",
      action: action,
      timestamp: new Date().toISOString(),
    };

    const success = mqttHandler.publishControl(command);

    if (success) {
      // Update device status in database
      const device = await Device.getDefaultDevice();
      await device.updateStatus({ led: action });

      res.json({
        success: true,
        message: `LED ${action}`,
        command: command,
      });
    } else {
      res.status(503).json({
        success: false,
        message: "MQTT not connected, cannot send command",
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error controlling LED",
      error: error.message,
    });
  }
};

// Control all devices at once
exports.controlAll = async (req, res) => {
  try {
    const { relay, buzzer, led } = req.body;

    const command = {
      device: "all",
      relay: relay || "off",
      buzzer: buzzer || "off",
      led: led || "off",
      timestamp: new Date().toISOString(),
    };

    const success = mqttHandler.publishControl(command);

    if (success) {
      res.json({
        success: true,
        message: "All devices controlled",
        command: command,
      });
    } else {
      res.status(503).json({
        success: false,
        message: "MQTT not connected, cannot send command",
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error controlling devices",
      error: error.message,
    });
  }
};

// Emergency stop (turn off everything)
exports.emergencyStop = async (req, res) => {
  try {
    const command = {
      device: "emergency",
      action: "stop_all",
      relay: "off",
      buzzer: "off",
      led: "off",
      timestamp: new Date().toISOString(),
    };

    const success = mqttHandler.publishControl(command);

    if (success) {
      res.json({
        success: true,
        message: "Emergency stop activated - All devices turned off",
        command: command,
      });
    } else {
      res.status(503).json({
        success: false,
        message: "MQTT not connected, cannot send command",
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error executing emergency stop",
      error: error.message,
    });
  }
};

// Test all devices (blink LED, beep buzzer, quick relay test)
exports.testDevices = async (req, res) => {
  try {
    const command = {
      device: "test",
      action: "test_all",
      timestamp: new Date().toISOString(),
    };

    const success = mqttHandler.publishControl(command);

    if (success) {
      res.json({
        success: true,
        message: "Device test initiated",
        description: "All devices will perform a short test sequence",
        command: command,
      });
    } else {
      res.status(503).json({
        success: false,
        message: "MQTT not connected, cannot send command",
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error testing devices",
      error: error.message,
    });
  }
};

// Get device status
exports.getStatus = async (req, res) => {
  try {
    const device = await Device.getDefaultDevice();

    res.json({
      success: true,
      mqtt: {
        connected: mqttHandler.isConnected(),
        broker: process.env.MQTT_BROKER,
      },
      device: {
        deviceId: device.deviceId,
        deviceName: device.deviceName,
        location: device.location,
        isOnline: device.isOnline,
        lastSeen: device.lastSeen,
        health: device.health,
        firmwareVersion: device.firmwareVersion,
        ipAddress: device.ipAddress,
        signalStrength: device.signalStrength,
        uptime: device.uptime,
      },
      status: {
        relay: device.relay.status,
        relayLastChanged: device.relay.lastChanged,
        buzzer: device.buzzer.status,
        buzzerLastChanged: device.buzzer.lastChanged,
        led: device.led.status,
        ledLastChanged: device.led.lastChanged,
      },
      settings: {
        autoMode: device.autoMode,
        tempThreshold: device.tempThreshold,
        gasThreshold: device.gasThreshold,
        humidityLowThreshold: device.humidityLowThreshold,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error getting device status",
      error: error.message,
    });
  }
};

// Update device settings
exports.updateSettings = async (req, res) => {
  try {
    const { autoMode, tempThreshold, gasThreshold, humidityLowThreshold } =
      req.body;

    const device = await Device.getDefaultDevice();

    if (autoMode !== undefined) device.autoMode = autoMode;
    if (tempThreshold !== undefined) device.tempThreshold = tempThreshold;
    if (gasThreshold !== undefined) device.gasThreshold = gasThreshold;
    if (humidityLowThreshold !== undefined)
      device.humidityLowThreshold = humidityLowThreshold;

    await device.save();

    res.json({
      success: true,
      message: "Device settings updated successfully",
      settings: {
        autoMode: device.autoMode,
        tempThreshold: device.tempThreshold,
        gasThreshold: device.gasThreshold,
        humidityLowThreshold: device.humidityLowThreshold,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error updating device settings",
      error: error.message,
    });
  }
};

// Update device info (heartbeat from ESP32)
exports.updateHeartbeat = async (req, res) => {
  try {
    const { deviceId, ipAddress, signalStrength, uptime, firmwareVersion } =
      req.body;

    const device = await Device.heartbeat(deviceId || "ESP32_001", {
      ipAddress,
      signalStrength,
      uptime,
      firmwareVersion,
    });

    res.json({
      success: true,
      message: "Device heartbeat updated",
      device: {
        deviceId: device.deviceId,
        isOnline: device.isOnline,
        lastSeen: device.lastSeen,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error updating heartbeat",
      error: error.message,
    });
  }
};
