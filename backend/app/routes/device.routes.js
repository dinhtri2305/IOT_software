const express = require("express");
const router = express.Router();
const deviceController = require("../controllers/device.controller");
const { protect, authorize } = require("../middleware/auth.middleware");

// All device routes require authentication
router.use(protect);

// Control endpoints (admin or device managers)
router.post(
  "/control/relay",
  authorize("admin"),
  deviceController.controlRelay
);
router.post(
  "/control/buzzer",
  authorize("admin"),
  deviceController.controlBuzzer
);
router.post("/control/led", authorize("admin"), deviceController.controlLED);
router.post("/control/all", authorize("admin"), deviceController.controlAll);

// Emergency and test
router.post("/emergency", authorize("admin"), deviceController.emergencyStop);
router.post("/test", authorize("admin"), deviceController.testDevices);

// Heartbeat and status (device may call heartbeat via MQTT or HTTP)
router.post("/heartbeat", deviceController.heartbeat);
router.get("/status", deviceController.getStatus);
router.post("/settings", authorize("admin"), deviceController.updateSettings);
router.post("/reboot", authorize("admin"), deviceController.rebootDevice);

module.exports = router;
