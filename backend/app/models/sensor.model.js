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
      required: true,
      min: [0, "Gas level cannot be negative"],
      max: [4095, "Gas level exceeds ADC range"],
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
  return await this.find({ deviceId })
    .sort({ timestamp: -1 })
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
  const tempHigh = this.temperature > 45;
  const gasHigh = this.gasLevel > 1500;

  // Mark fire when both temperature and gas are high (avoid false positives)
  if (tempHigh && gasHigh) {
    this.fireDetected = true;
  } else {
    this.fireDetected = false;
  }

  next();
});

const SensorData = mongoose.model("SensorData", sensorDataSchema);

module.exports = SensorData;
