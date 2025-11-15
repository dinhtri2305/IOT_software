const express = require("express");
const router = express.Router();
const analyticsController = require("../controllers/analytics.controller");
const { protect } = require("../middleware/auth.middleware");

// All analytics routes require authentication
router.use(protect);

// GET /api/analytics/temp-humidity-correlation - Temperature vs Humidity correlation
// Query: ?hours=168 (default 7 days)
router.get(
  "/temp-humidity-correlation",
  analyticsController.getTempHumidityCorrelation
);

// GET /api/analytics/gas-distribution - Gas level distribution and trends
// Query: ?hours=168 (default 7 days)
router.get("/gas-distribution", analyticsController.getGasDistribution);

// GET /api/analytics/predict-next-day - Predict temperature & humidity for next 24 hours
// Query: ?days=7 (default 7 days of training data)
router.get("/predict-next-day", analyticsController.predictNextDay);

// GET /api/analytics/weekly-summary - Get 7-day summary for dashboard
router.get("/weekly-summary", analyticsController.getWeeklySummary);

// GET /api/analytics/fire-risk - Get fire risk analysis
// Query: ?hours=24
router.get("/fire-risk", analyticsController.getFireRiskAnalysis);

module.exports = router;
