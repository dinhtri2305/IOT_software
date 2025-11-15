const express = require("express");
const router = express.Router();
const sensorController = require("../controllers/sensor.controller");
const { protect } = require("../middleware/auth.middleware");

// All sensor routes require authentication
router.use(protect);

// GET /api/sensor/latest - Get latest sensor readings
router.get("/latest", sensorController.getLatest);

// GET /api/sensor/current - Get current sensor reading (single)
router.get("/current", sensorController.getCurrent);

// GET /api/sensor/history - Get sensor history with pagination
router.get("/history", sensorController.getHistory);

// GET /api/sensor/fire-alerts - Get fire alert history
router.get("/fire-alerts", sensorController.getFireAlerts);

// GET /api/sensor/statistics - Get statistics
router.get("/statistics", sensorController.getStatistics);

// GET /api/sensor/chart-data - Get data for charts
router.get("/chart-data", sensorController.getChartData);

// POST /api/sensor/manual - Manually add sensor data (for testing)
router.post("/manual", sensorController.createManual);

// DELETE /api/sensor/old - Delete old data (cleanup)
router.delete("/old", sensorController.deleteOld);

module.exports = router;
