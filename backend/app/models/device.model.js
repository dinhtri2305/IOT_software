const mongoose = require("mongoose");

// helper to generate default deviceId if none provided
function generateDeviceId() {
  return `ESP32_${Math.random().toString(36).substr(2, 8).toUpperCase()}`;
}

const deviceSchema = new mongoose.Schema(
  {
    deviceId: {
      type: String,
      required: true,
      unique: true,
      default: generateDeviceId,
    },
    deviceName: {
      type: String,
      default: "Fire Detection System",
    },
    location: {
      type: String,
      default: "Room 1",
    },
    isOnline: {
      type: Boolean,
      default: false,
    },
    lastSeen: {
      type: Date,
      default: Date.now,
    },
    // Device states
    relay: {
      status: {
        type: String,
        enum: ["on", "off"],
        default: "off",
      },
      lastChanged: {
        type: Date,
        default: Date.now,
      },
    },
    buzzer: {
      status: {
        type: String,
        enum: ["on", "off"],
        default: "off",
      },
      lastChanged: {
        type: Date,
        default: Date.now,
      },
    },
    led: {
      status: {
        type: String,
        enum: ["on", "off", "blink"],
        default: "off",
      },
      lastChanged: {
        type: Date,
        default: Date.now,
      },
    },
    // System info
    firmwareVersion: {
      type: String,
      default: "1.0.0",
    },
    ipAddress: {
      type: String,
      default: "",
    },
    signalStrength: {
      type: Number,
      default: 0,
      min: -100,
      max: 0,
    },
    uptime: {
      type: Number,
      default: 0,
    },
    // Settings
    autoMode: {
      type: Boolean,
      default: true,
    },
    tempThreshold: {
      type: Number,
      default: 45.0,
    },
    gasThreshold: {
      type: Number,
      default: 1500,
    },
    humidityLowThreshold: {
      type: Number,
      default: 30.0,
    },
  },
  {
    timestamps: true,
  }
);

// Ensure virtuals are included when converting to JSON
deviceSchema.set("toJSON", { virtuals: true });
deviceSchema.set("toObject", { virtuals: true });

// Index for faster queries
deviceSchema.index({ deviceId: 1 }, { unique: true });
deviceSchema.index({ isOnline: 1 });

// Virtual property for overall device health
deviceSchema.virtual("health").get(function () {
  if (!this.isOnline) return "offline";

  if (!this.lastSeen) return "unknown";

  const timeSinceLastSeen = Date.now() - new Date(this.lastSeen).getTime();
  const fiveMinutes = 5 * 60 * 1000;

  if (timeSinceLastSeen > fiveMinutes) return "warning";
  if (this.signalStrength !== undefined && this.signalStrength < -80)
    return "poor";

  return "good";
});

// Instance method to update device status
deviceSchema.methods.updateStatus = async function (updates = {}) {
  if (updates.relay !== undefined) {
    this.relay.status = updates.relay;
    this.relay.lastChanged = new Date();
  }

  if (updates.buzzer !== undefined) {
    this.buzzer.status = updates.buzzer;
    this.buzzer.lastChanged = new Date();
  }

  if (updates.led !== undefined) {
    this.led.status = updates.led;
    this.led.lastChanged = new Date();
  }

  if (updates.isOnline !== undefined) {
    this.isOnline = updates.isOnline;
  }

  if (updates.ipAddress !== undefined) this.ipAddress = updates.ipAddress;
  if (updates.signalStrength !== undefined)
    this.signalStrength = updates.signalStrength;
  if (updates.uptime !== undefined) this.uptime = updates.uptime;

  this.lastSeen = new Date();

  return await this.save();
};

// Instance method to check if device needs attention
deviceSchema.methods.needsAttention = function () {
  if (!this.lastSeen) return true;
  const timeSinceLastSeen = Date.now() - new Date(this.lastSeen).getTime();
  const tenMinutes = 10 * 60 * 1000;

  return !this.isOnline || timeSinceLastSeen > tenMinutes;
};

// Static method to get or create default device
deviceSchema.statics.getDefaultDevice = async function () {
  let device = await this.findOne({ deviceId: "ESP32_001" });

  if (!device) {
    device = await this.create({
      deviceId: "ESP32_001",
      deviceName: "Fire Detection System",
      location: "Room 1",
    });
  }

  return device;
};

// Static method to update device heartbeat
deviceSchema.statics.heartbeat = async function (deviceId, systemInfo = {}) {
  const device = await this.findOne({ deviceId });

  if (!device) {
    return await this.create({
      deviceId,
      isOnline: true,
      lastSeen: new Date(),
      ...systemInfo,
    });
  }

  device.isOnline = true;
  device.lastSeen = new Date();

  if (systemInfo.ipAddress) device.ipAddress = systemInfo.ipAddress;
  if (systemInfo.signalStrength !== undefined)
    device.signalStrength = systemInfo.signalStrength;
  if (systemInfo.uptime !== undefined) device.uptime = systemInfo.uptime;
  if (systemInfo.firmwareVersion)
    device.firmwareVersion = systemInfo.firmwareVersion;

  return await device.save();
};

// Static method to mark device as offline
deviceSchema.statics.markOffline = async function (deviceId) {
  return await this.findOneAndUpdate(
    { deviceId },
    {
      isOnline: false,
      lastSeen: new Date(),
    },
    { new: true }
  );
};

// Static method to get all devices status
deviceSchema.statics.getAllStatus = async function () {
  const devices = await this.find().lean();

  return devices.map((device) => ({
    deviceId: device.deviceId,
    deviceName: device.deviceName,
    location: device.location,
    isOnline: device.isOnline,
    lastSeen: device.lastSeen,
    relay: device.relay?.status,
    buzzer: device.buzzer?.status,
    led: device.led?.status,
    health: device.health,
    signalStrength: device.signalStrength,
    firmwareVersion: device.firmwareVersion,
  }));
};

// Pre-save middleware to validate thresholds
deviceSchema.pre("save", function (next) {
  // Validate temperature threshold
  if (this.tempThreshold < 0 || this.tempThreshold > 100) {
    return next(new Error("Temperature threshold must be between 0 and 100"));
  }

  // Validate gas threshold
  if (this.gasThreshold < 0 || this.gasThreshold > 4095) {
    return next(new Error("Gas threshold must be between 0 and 4095"));
  }

  // Validate humidity threshold
  if (this.humidityLowThreshold < 0 || this.humidityLowThreshold > 100) {
    return next(new Error("Humidity threshold must be between 0 and 100"));
  }

  next();
});

const Device = mongoose.model("Device", deviceSchema);

module.exports = Device;
