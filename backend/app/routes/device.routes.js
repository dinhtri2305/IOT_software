const express = require("express");
const router = express.Router();
const deviceController = require("../controllers/device.controller");
const { protect, authorize } = require("../middleware/auth.middleware");

// All device routes require authentication
router.use(protect);

// Control endpoints (require authentication)
router.post("/control/relay", deviceController.controlRelay);
router.post("/control/buzzer", deviceController.controlBuzzer);
router.post("/control/led", deviceController.controlLED);
router.post("/control/lcd", deviceController.controlLCD);
router.post("/control/all", deviceController.controlAll);

// Emergency and test
router.post("/emergency", deviceController.emergencyStop);
router.post("/test", deviceController.testDevices);

// Heartbeat and status (device may call heartbeat via MQTT or HTTP)
router.post("/heartbeat", deviceController.heartbeat);
router.get("/status", deviceController.getStatus);
router.post("/settings", deviceController.updateSettings);
router.post("/reboot", deviceController.rebootDevice);

module.exports = router;
