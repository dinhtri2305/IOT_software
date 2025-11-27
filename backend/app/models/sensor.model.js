const mongoose = require("mongoose");

const sensorDataSchema = new mongoose.Schema(
  {
    temperature: {
      type: Number,
      required: true,
      min: -50,
      max: 150,
    },
    humidity: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    gasLevel: {
      type: Number,
      required: true,
      min: 0,
      max: 4095,
    },
    fireDetected: {
      type: Boolean,
      default: false,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
    deviceId: {
      type: String,
      default: "ESP32_001",
    },
    location: {
      type: String,
      default: "Room 1",
    },
  },
  {
    timestamps: true,
    collection: "sensor_data",
  }
);

// Indexes for better query performance
sensorDataSchema.index({ timestamp: -1 });
sensorDataSchema.index({ fireDetected: 1 });

// Virtual property for alert level
sensorDataSchema.virtual("alertLevel").get(function () {
  if (this.fireDetected) return "critical";
  if (this.temperature > 45 || this.gasLevel > 1500) return "warning";
  if (this.humidity < 30) return "caution";
  return "normal";
});

// Instance method to check if data is critical
sensorDataSchema.methods.isCritical = function () {
  return this.fireDetected || this.temperature > 50 || this.gasLevel > 2000;
};

// Static method to get latest data
sensorDataSchema.statics.getLatest = function (limit = 10) {
  return this.find().sort({ timestamp: -1 }).limit(limit).lean();
};

// Static method to get fire alerts
sensorDataSchema.statics.getFireAlerts = function (startDate, endDate) {
  const query = { fireDetected: true };

  if (startDate && endDate) {
    query.timestamp = { $gte: startDate, $lte: endDate };
  }

  return this.find(query).sort({ timestamp: -1 }).lean();
};

// Static method to get statistics
sensorDataSchema.statics.getStatistics = async function (hours = 24) {
  const startTime = new Date(Date.now() - hours * 60 * 60 * 1000);

  const stats = await this.aggregate([
    { $match: { timestamp: { $gte: startTime } } },
    {
      $group: {
        _id: null,
        avgTemperature: { $avg: "$temperature" },
        avgHumidity: { $avg: "$humidity" },
        avgGasLevel: { $avg: "$gasLevel" },
        maxTemperature: { $max: "$temperature" },
        maxGasLevel: { $max: "$gasLevel" },
        minHumidity: { $min: "$humidity" },
        fireCount: {
          $sum: { $cond: ["$fireDetected", 1, 0] },
        },
        totalRecords: { $sum: 1 },
      },
    },
  ]);

  return stats[0] || {};
};

// Pre-save middleware
sensorDataSchema.pre("save", function (next) {
  // Auto-detect fire based on thresholds
  if (this.temperature > 45 || this.gasLevel > 1500) {
    this.fireDetected = true;
  }
  next();
});

const SensorData = mongoose.model("SensorData", sensorDataSchema);

module.exports = SensorData;
