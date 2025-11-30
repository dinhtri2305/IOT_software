// app/routes/sensor.routes.js
const express = require("express");
const router = express.Router();

const sensorController = require("../controllers/sensor.controller");
const { protect, authorize } = require("../middleware/auth.middleware");
const {
  queryValidator,
  validate,
} = require("../middleware/validator.middleware");

// ==================== PUBLIC ROUTE: ESP32 gửi dữ liệu (không cần JWT)
router.post(
  "/data",
  // Rate limit 10 lần/giây/device để chống spam (implement later)
  queryValidator([{ name: "deviceId", required: true }]),
  sensorController.receiveFromESP32
);

// From here, routes require authentication
router.use(protect);

// ==================== ROUTES CHỈ ADMIN/USER ĐƯỢC DÙNG ====================

// Lấy dữ liệu mới nhất (realtime dashboard)
router.get("/latest", sensorController.getLatest);

// Lấy 1 bản ghi hiện tại duy nhất
router.get("/current", sensorController.getCurrent);

// Lịch sử dữ liệu + phân trang + lọc theo thời gian/device
router.get(
  "/history",
  queryValidator([
    { name: "page", type: "number", default: 1 },
    { name: "limit", type: "number", default: 50, max: 1000 },
    { name: "startDate", type: "date" },
    { name: "endDate", type: "date" },
    { name: "deviceId" },
  ]),
  validate,
  sensorController.getHistory
);

// Lịch sử báo cháy
router.get("/fire-alerts", sensorController.getFireAlerts);

// Thống kê 24h / 7 ngày / 30 ngày
router.get(
  "/statistics",
  queryValidator([
    { name: "hours", type: "number", default: 24 },
    { name: "deviceId" },
  ]),
  validate,
  sensorController.getStatistics
);

// Dữ liệu cho biểu đồ (Chart.js, Recharts...)
router.get(
  "/chart-data",
  queryValidator([
    {
      name: "type",
      required: true,
      values: ["temperature", "humidity", "gas"],
    },
    { name: "range", values: ["1h", "6h", "24h", "7d"], default: "24h" },
    { name: "deviceId" },
  ]),
  validate,
  sensorController.getChartData
);

// Tạo dữ liệu giả để test (yêu cầu authenticated)
router.post("/manual", sensorController.createManual);

// Xóa dữ liệu cũ (yêu cầu authenticated)
router.delete(
  "/cleanup",
  queryValidator([{ name: "days", type: "number", required: true, min: 1 }]),
  validate,
  sensorController.deleteOldData
);

// Export
module.exports = router;
