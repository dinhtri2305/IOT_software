// backend/server.js
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const compression = require("compression");

// Import database & MQTT
const connectDB = require("./app/config/db.config");
const mqttHandler = require("./utils/mqtt_handler");

// Import routes
const sensorRoutes = require("./app/routes/sensor.routes");
const deviceRoutes = require("./app/routes/device.routes");
// const authRoutes = require("./app/routes/auth.routes"); // nếu có auth thì bỏ comment
// const analyticsRoutes = require("./app/routes/analytics.routes");

const app = express();
const PORT = process.env.PORT || 3000;

// ========================================
// MIDDLEWARE
// ========================================
app.use(helmet({
  contentSecurityPolicy: false, // nếu frontend dùng inline script
  crossOriginEmbedderPolicy: false
}));
app.use(cors({
  origin: process.env.CORS_ORIGIN || "http://localhost:3001",
  credentials: true,
}));
app.use(morgan("dev"));
app.use(compression());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// ========================================
// DATABASE & MQTT CONNECTION
// ========================================
connectDB();
mqttHandler.connect();

// ========================================
// ROUTES
// ========================================
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Fire Detection System API is ALIVE!",
    version: "1.0.0",
    time: new Date().toISOString(),
    endpoints: {
      sensor: "/api/sensor",
      device: "/api/device",
      health: "/api/health",
    },
  });
});

app.get("/api/health", (req, res) => {
  const mongoose = require("mongoose");
  res.json({
    success: true,
    status: "healthy",
    database: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
    mqtt: mqttHandler.isConnected() ? "connected" : "disconnected",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// API Routes
app.use("/api/sensor", sensorRoutes);
app.use("/api/device", deviceRoutes);
// app.use("/api/auth", authRoutes);      // khi có login
// app.use("/api/analytics", analyticsRoutes);

// ========================================
// ERROR HANDLING
// ========================================
app.use("*", (req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
    path: req.originalUrl,
    available: ["/", "/api/sensor", "/api/device", "/api/health"]
  });
});

app.use((err, req, res, next) => {
  console.error("Unhandled Error:", err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal Server Error",
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
});

// ========================================
// GRACEFUL SHUTDOWN
// ========================================
const server = app.listen(PORT, () => {
  console.log("========================================");
  console.log("FIRE DETECTION BACKEND SERVER");
  console.log("========================================");
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`MQTT Broker: ${process.env.MQTT_BROKER || "not set"}`);
  console.log("========================================");
});

// Xử lý tắt server sạch sẽ
const gracefulShutdown = (signal) => {
  console.log(`\n${signal} received. Shutting down gracefully...`);
  mqttHandler.disconnect();
  server.close(() => {
    console.log("Closed all remaining connections.");
    process.exit(0);
  });

  // Force close sau 10s nếu còn treo
  setTimeout(() => {
    console.error("Forcing shutdown...");
    process.exit(1);
  }, 10000);
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
  gracefulShutdown("uncaughtException");
});
process.on("unhandledRejection", (err) => {
  console.error("Unhandled Rejection:", err);
  gracefulShutdown("unhandledRejection");
});

module.exports = app;