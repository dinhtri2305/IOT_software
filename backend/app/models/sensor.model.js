// app/models/sensor.model.js
const mongoose = require("mongoose");

const sensorDataSchema = new mongoose.Schema(
  {
    // ==================== DỮ LIỆU CẢM BIẾN ====================
    temperature: {
      type: Number,
      required: true,
      min: [-50, "Temperature too low"],
      max: [150, "Temperature too high"],
    },
    humidity: {
      type: Number,
      required: true,
      min: [0, "Humidity cannot be negative"],
      max: [100, "Humidity cannot exceed 100%"],
    },
    gasLevel: {
      type: Number,
      required: false,
      default: null,
      min: 0,
      // XÓA DÒNG max: 4095 hoặc max: 10000 đi luôn!
    },
    ldrValue: {
      type: Number,
      required: false,
      default: null,
      min: 0,
    },
    lightLed: {
      type: String,
      enum: ["on", "off", null],
      default: null,
    },
    // No flame sensor available on target devices; remove flame field
    fireDetected: {
      type: Boolean,
      default: false,
      index: true,
    },

    // ==================== THÔNG TIN THIẾT BỊ & VỊ TRÍ ====================
    deviceId: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    deviceName: String,
    location: {
      type: String,
      default: "Unknown",
      trim: true,
    },

    // Message ID để chống lưu trùng (kết hợp deviceId + messageId)
    messageId: {
      type: Number,
      index: true,
    },

    // ==================== THỜI GIAN ====================
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    collection: "sensor_data",
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ==================== INDEX TỐI ƯU TRUY VẤN ====================
sensorDataSchema.index({ deviceId: 1, timestamp: -1 }); // Dashboard realtime
sensorDataSchema.index({ fireDetected: 1, timestamp: -1 }); // Báo cháy nhanh
sensorDataSchema.index({ timestamp: -1 }); // Lịch sử
sensorDataSchema.index(
  { deviceId: 1, messageId: 1 },
  { unique: true, sparse: true }
);

// ==================== VIRTUAL: MỨC CẢNH BÁO ====================
sensorDataSchema.virtual("alertLevel").get(function () {
  if (this.fireDetected) return "CRITICAL";
  if (this.temperature > 50 || this.gasLevel > 2000) return "HIGH";
  if (this.temperature > 40 || this.gasLevel > 1200 || this.humidity < 25)
    return "WARNING";
  if (this.humidity < 35) return "LOW_HUMIDITY";
  return "NORMAL";
});

// ==================== INSTANCE METHODS ====================
sensorDataSchema.methods.isCritical = function () {
  return (
    this.fireDetected || this.temperature > 55 || this.gasLevel > 2500 || false
  );
};

// ==================== STATIC METHODS ====================
// Lấy dữ liệu mới nhất theo device
sensorDataSchema.statics.getLatestByDevice = async function (
  deviceId,
  limit = 1
) {
  const filter = {};
  // If a deviceId is provided (non-null/undefined/empty), filter by it,
  // otherwise return latest across all devices.
  if (
    deviceId !== undefined &&
    deviceId !== null &&
    String(deviceId).trim() !== ""
  ) {
    filter.deviceId = deviceId;
  }

  // Prefer the most recently received record (server insertion time).
  // Many devices may send invalid/epoch timestamps, so sort by `createdAt`
  // first then `timestamp` as a tiebreaker.
  return await this.find(filter)
    .sort({ createdAt: -1, timestamp: -1 })
    .limit(limit)
    .lean();
};

// Lấy tất cả dữ liệu trong khoảng thời gian
sensorDataSchema.statics.getInRange = async function (
  start,
  end,
  deviceId = null
) {
  const query = { timestamp: { $gte: start, $lte: end } };
  if (deviceId) query.deviceId = deviceId;
  return await this.find(query).sort({ timestamp: -1 }).lean();
};

// Thống kê 24h gần nhất (rất hay cho dashboard)
sensorDataSchema.statics.get24hStats = async function (deviceId = null) {
  const startTime = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const match = { timestamp: { $gte: startTime } };
  if (deviceId) match.deviceId = deviceId;

  const stats = await this.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        avgTemp: { $avg: "$temperature" },
        maxTemp: { $max: "$temperature" },
        minTemp: { $min: "$temperature" },
        avgHum: { $avg: "$humidity" },
        maxGas: { $max: "$gasLevel" },
        fireAlerts: { $sum: { $cond: ["$fireDetected", 1, 0] } },
        totalRecords: { $sum: 1 },
      },
    },
    {
      $project: {
        _id: 0,
        avgTemp: { $round: ["$avgTemp", 1] },
        maxTemp: 1,
        minTemp: 1,
        avgHum: { $round: ["$avgHum", 1] },
        maxGas: 1,
        fireAlerts: 1,
        totalRecords: 1,
      },
    },
  ]);

  return (
    stats[0] || {
      avgTemp: 0,
      maxTemp: 0,
      minTemp: 0,
      avgHum: 0,
      maxGas: 0,
      fireAlerts: 0,
      totalRecords: 0,
    }
  );
};

// ==================== PRE-SAVE: TỰ ĐỘNG PHÁT HIỆN CHÁY ====================
sensorDataSchema.pre("save", function (next) {
  // If device explicitly reported `fireDetected: true`, trust that value.
  // Otherwise compute using server thresholds (temperature + gas).
  if (this.fireDetected === true) {
    return next();
  }

  const tempHigh = this.temperature > 45;
  const gasHigh = this.gasLevel > 1500;

  // Mark fire when both temperature and gas are high (avoid false positives)
  this.fireDetected = !!(tempHigh && gasHigh);
  return next();
});

const SensorData = mongoose.model("SensorData", sensorDataSchema);

module.exports = SensorData;
