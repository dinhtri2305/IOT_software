// app/models/device.model.js
const mongoose = require("mongoose");

const deviceSchema = new mongoose.Schema(
  {
    deviceId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    deviceName: { type: String, default: "Fire Detection System", trim: true },
    location: { type: String, default: "Unknown", trim: true },

    isOnline: { type: Boolean, default: false },
    lastSeen: { type: Date, default: Date.now },

    // Device actuators
    relay: {
      status: { type: String, enum: ["on", "off"], default: "off" },
      lastChanged: { type: Date, default: Date.now },
    },
    buzzer: {
      status: { type: String, enum: ["on", "off"], default: "off" },
      lastChanged: { type: Date, default: Date.now },
    },
    led: {
      status: { type: String, enum: ["on", "off", "blink"], default: "off" },
      lastChanged: { type: Date, default: Date.now },
    },

    // System info
    firmwareVersion: { type: String, default: "1.0.0" },
    ipAddress: { type: String, default: "" },
    macAddress: { type: String, sparse: true, uppercase: true },
    signalStrength: { type: Number, default: 0, min: -100, max: 0 },
    uptime: { type: Number, default: 0 },

    // Settings
    autoMode: { type: Boolean, default: true },
    tempThreshold: { type: Number, default: 45.0, min: 0, max: 100 },
    gasThreshold: { type: Number, default: 1500, min: 0, max: 4095 },
    flameThreshold: { type: Number, default: 300, min: 0, max: 1023 },
    humidityLowThreshold: { type: Number, default: 30.0, min: 0, max: 100 },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ==================== INDEXES ====================
deviceSchema.index({ deviceId: 1 }, { unique: true });
deviceSchema.index({ isOnline: 1, lastSeen: -1 });
deviceSchema.index({ createdAt: -1 });

// ==================== VIRTUALS ====================
deviceSchema.virtual("health").get(function () {
  if (!this.isOnline) return "offline";

  const minutesSinceLastSeen = (Date.now() - this.lastSeen) / 60000;
  if (minutesSinceLastSeen > 10) return "offline";
  if (minutesSinceLastSeen > 3) return "warning";
  if (this.signalStrength < -85) return "poor";

  return "good";
});

// ==================== METHODS ====================
// Cập nhật trạng thái relay/buzzer/led
deviceSchema.methods.updateActuators = async function ({
  relay,
  buzzer,
  led,
} = {}) {
  if (relay !== undefined) {
    this.relay.status = relay;
    this.relay.lastChanged = new Date();
  }
  if (buzzer !== undefined) {
    this.buzzer.status = buzzer;
    this.buzzer.lastChanged = new Date();
  }
  if (led !== undefined) {
    this.led.status = led;
    this.led.lastChanged = new Date();
  }
  this.lastSeen = new Date();
  return await this.save();
};

// ==================== STATICS ====================
// Heartbeat – tự động tạo device nếu chưa có
deviceSchema.statics.heartbeat = async function (deviceId, info = {}) {
  return await this.findOneAndUpdate(
    { deviceId },
    {
      $set: {
        isOnline: true,
        lastSeen: new Date(),
        ipAddress: info.ipAddress || null,
        signalStrength: info.signalStrength ?? null,
        uptime: info.uptime ?? null,
        firmwareVersion: info.firmwareVersion || this.firmwareVersion,
        macAddress: info.macAddress || this.macAddress,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
};

// Lấy tất cả thiết bị với trạng thái đẹp
deviceSchema.statics.getAllStatus = async function () {
  return await this.find({})
    .sort({ lastSeen: -1 })
    .lean()
    .then((devices) =>
      devices.map((d) => ({
        deviceId: d.deviceId,
        deviceName: d.deviceName,
        location: d.location,
        isOnline: d.isOnline,
        lastSeen: d.lastSeen,
        health: d.health,
        relay: d.relay.status,
        buzzer: d.buzzer.status,
        led: d.led.status,
        signalStrength: d.signalStrength,
        firmwareVersion: d.firmwareVersion,
        uptime: d.uptime,
        ipAddress: d.ipAddress,
      }))
    );
};

// ==================== MIDDLEWARE ====================
deviceSchema.pre("save", function (next) {
  // Auto uppercase deviceId
  if (this.deviceId) this.deviceId = this.deviceId.toUpperCase().trim();

  // Validation
  if (
    this.isModified("tempThreshold") &&
    (this.tempThreshold < 20 || this.tempThreshold > 80)
  ) {
    return next(new Error("tempThreshold should be 20–80°C"));
  }
  if (
    this.isModified("gasThreshold") &&
    (this.gasThreshold < 300 || this.gasThreshold > 3000)
  ) {
    return next(new Error("gasThreshold should be 300–3000"));
  }
  next();
});

const Device = mongoose.model("Device", deviceSchema);
module.exports = Device;
