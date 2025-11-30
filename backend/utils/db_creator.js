// utils/db_creator.js
// Small DB seed script to create an admin user and a sample device.
// Run: `node utils/db_creator.js` from backend folder.

require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../app/models/user.model");
const Device = require("../app/models/device.model");

async function connect() {
  const uri =
    process.env.MONGODB_URI || "mongodb://localhost:27017/fire_detection_db";
  await mongoose.connect(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
}

async function createAdmin() {
  const adminEmail = process.env.ADMIN_EMAIL || "admin@example.com";
  const adminUser = await User.findOne({ email: adminEmail });
  if (adminUser) {
    console.log("Admin user already exists:", adminEmail);
    return adminUser;
  }

  const admin = new User({
    name: process.env.ADMIN_NAME || "Admin",
    email: adminEmail,
    password: process.env.ADMIN_PASSWORD || "admin123",
  });

  await admin.save();
  console.log("Created admin user:", admin.email);
  return admin;
}

async function createSampleDevice() {
  const deviceId = process.env.SAMPLE_DEVICE_ID || "ESP32_001";
  const existing = await Device.findOne({ deviceId });
  if (existing) {
    console.log("Sample device already exists:", deviceId);
    return existing;
  }

  const device = new Device({
    deviceId,
    deviceName: "ESP32 Sample Device",
    location: "Lab",
    isOnline: false,
    firmwareVersion: "1.0.0",
  });

  await device.save();
  console.log("Created sample device:", device.deviceId);
  return device;
}

async function main() {
  try {
    console.log("Connecting to MongoDB...");
    await connect();
    console.log("Connected");

    await createAdmin();
    await createSampleDevice();

    console.log("DB seeding complete");
    process.exit(0);
  } catch (err) {
    console.error("DB seeding failed:", err);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
