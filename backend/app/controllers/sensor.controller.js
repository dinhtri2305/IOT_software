const SensorData = require("../models/sensor.model");
const Device = require("../models/device.model");

// Receive data from ESP32 (public endpoint)
exports.receiveFromESP32 = async (req, res) => {
  try {
    const {
      deviceId,
      temperature,
      humidity,
      gasLevel,
      firmwareVersion,
      fireDetected,
      timestamp,
    } = req.body;
    if (
      !deviceId ||
      temperature === undefined ||
      humidity === undefined ||
      gasLevel === undefined
    ) {
      return res
        .status(400)
        .json({ success: false, message: "Missing required sensor fields" });
    }

    const payload = {
      deviceId,
      temperature: Number(temperature),
      humidity: Number(humidity),
      gasLevel: Number(gasLevel),
    };

    // Accept device-provided fireDetected flag if present
    if (fireDetected !== undefined) payload.fireDetected = !!fireDetected;

    // If device provides a numeric timestamp (e.g., epoch seconds/ms) try to use it
    if (timestamp !== undefined && timestamp !== null) {
      const t = Number(timestamp);
      // If timestamp looks like seconds (<= 1e10), convert to ms
      payload.timestamp = new Date(t > 1e10 ? t : t * 1000);
    }

    const record = await SensorData.create(payload);

    // Update device heartbeat
    try {
      await Device.heartbeat(deviceId, { firmwareVersion });
    } catch (e) {
      // ignore heartbeat errors
    }

    return res
      .status(201)
      .json({ success: true, message: "Sensor data received", data: record });
  } catch (error) {
    console.error("Error receiving ESP32 data:", error.message);
    return res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

// Get latest readings
exports.getLatest = async (req, res) => {
  try {
    const deviceId = req.query.deviceId;
    const limit = Number(req.query.limit) || 10;
    const data = await SensorData.find(deviceId ? { deviceId } : {})
      .sort({ timestamp: -1, createdAt: -1 })
      .limit(limit)
      .lean();
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Error fetching latest data",
      error: err.message,
    });
  }
};

exports.getCurrent = async (req, res) => {
  try {
    const deviceId = req.query.deviceId;
    const latest = await SensorData.getLatestByDevice(deviceId || null, 1);
    res.json({ success: true, data: latest[0] || null });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Error fetching current data",
      error: err.message,
    });
  }
};

exports.getHistory = async (req, res) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Math.min(Number(req.query.limit) || 50, 1000);
    const skip = (page - 1) * limit;
    const filter = {};
    if (req.query.deviceId) filter.deviceId = req.query.deviceId;
    if (req.query.startDate || req.query.endDate) filter.timestamp = {};
    if (req.query.startDate)
      filter.timestamp.$gte = new Date(req.query.startDate);
    if (req.query.endDate) filter.timestamp.$lte = new Date(req.query.endDate);

    const total = await SensorData.countDocuments(filter);
    const items = await SensorData.find(filter)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    res.json({ success: true, page, limit, total, items });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Error fetching history",
      error: err.message,
    });
  }
};

exports.getFireAlerts = async (req, res) => {
  try {
    const alerts = await SensorData.find({ fireDetected: true })
      .sort({ timestamp: -1 })
      .limit(100)
      .lean();
    res.json({ success: true, alerts });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Error fetching fire alerts",
      error: err.message,
    });
  }
};

exports.getStatistics = async (req, res) => {
  try {
    const hours = Number(req.query.hours) || 24;
    const startTime = new Date(Date.now() - hours * 60 * 60 * 1000);
    const agg = await SensorData.aggregate([
      { $match: { timestamp: { $gte: startTime } } },
      {
        $group: {
          _id: null,
          avgTemp: { $avg: "$temperature" },
          avgHum: { $avg: "$humidity" },
          avgGas: { $avg: "$gasLevel" },
          total: { $sum: 1 },
        },
      },
    ]);
    res.json({ success: true, stats: agg[0] || {} });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Error fetching statistics",
      error: err.message,
    });
  }
};

exports.getChartData = async (req, res) => {
  try {
    const type = req.query.type || "temperature";
    const range = req.query.range || "24h";
    // Simple implementation: return last N points
    const points = await SensorData.find({})
      .sort({ timestamp: -1 })
      .limit(100)
      .lean();
    res.json({
      success: true,
      type,
      range,
      points: points.map((p) => ({ x: p.timestamp, y: p[type] })),
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Error fetching chart data",
      error: err.message,
    });
  }
};

exports.createManual = async (req, res) => {
  try {
    const body = req.body;
    const record = await SensorData.create(body);
    res.status(201).json({ success: true, data: record });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Error creating manual data",
      error: err.message,
    });
  }
};

exports.deleteOldData = async (req, res) => {
  try {
    const days = Number(req.query.days) || 30;
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const result = await SensorData.deleteMany({ timestamp: { $lt: cutoff } });
    res.json({ success: true, deletedCount: result.deletedCount });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Error deleting old data",
      error: err.message,
    });
  }
};

module.exports = exports;
