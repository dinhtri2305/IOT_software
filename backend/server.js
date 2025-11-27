require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const compression = require("compression");
const bodyParser = require("body-parser");

// Import database connection
const connectDB = require("./app/config/db.config");

// Import MQTT handler
const mqttHandler = require("./utils/mqtt_handler");

// Import routes
const authRoutes = require("./app/routes/auth.routes");
const sensorRoutes = require("./app/routes/sensor.routes");
const deviceRoutes = require("./app/routes/device.routes");
const analyticsRoutes = require("./app/routes/analytics.routes");

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// ========================================
// MIDDLEWARE
// ========================================

// Security headers
app.use(helmet());

// Enable CORS
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  })
);

// Logging
app.use(morgan("dev"));

// Compression
app.use(compression());

// Body parser
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// ========================================
// DATABASE CONNECTION
// ========================================
connectDB();

// ========================================
// MQTT CONNECTION
// ========================================
mqttHandler.connect();

// ========================================
// ROUTES
// ========================================

// Health check
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "🔥 Fire Detection System API is running!",
    version: "1.0.0",
    endpoints: {
      sensor: "/api/sensor",
      device: "/api/device",
      health: "/api/health",
    },
  });
});

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    status: "healthy",
    database: "connected",
    mqtt: mqttHandler.isConnected() ? "connected" : "disconnected",
    timestamp: new Date().toISOString(),
  });
});

// API Routes
app.use("/api/sensor", sensorRoutes);
app.use("/api/device", deviceRoutes);

// ========================================
// ERROR HANDLING
// ========================================

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
    path: req.originalUrl,
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error("Error:", err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal Server Error",
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
});

// ========================================
// START SERVER
// ========================================
app.listen(PORT, () => {
  console.log("========================================");
  console.log("🔥 Fire Detection Backend Server");
  console.log("========================================");
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 Environment: ${process.env.NODE_ENV}`);
  console.log(`🌐 API URL: http://localhost:${PORT}`);
  console.log(`📊 MQTT Broker: ${process.env.MQTT_BROKER}`);
  console.log("========================================");
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down gracefully...");
  mqttHandler.disconnect();
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("SIGINT received, shutting down gracefully...");
  mqttHandler.disconnect();
  process.exit(0);
});

module.exports = app;
