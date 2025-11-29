require("dotenv").config();
const mongoose = require("mongoose");

async function run() {
  const uri =
    process.env.MONGO_URI ||
    process.env.MONGO_URL ||
    process.env.MONGO_CONNECTION ||
    "mongodb://localhost:27017/fire_detection_db";
  console.log("Connecting to", uri);
  await mongoose.connect(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  const db = mongoose.connection.db;

  try {
    const coll = db.collection("users");
    const indexes = await coll.indexes();
    console.log("Existing indexes on users collection:");
    indexes.forEach((ix) => console.log(" -", ix.name, JSON.stringify(ix.key)));

    // Find index whose key contains username: 1
    const idx = indexes.find(
      (ix) => ix.key && (ix.key.username === 1 || ix.key.username === "1")
    );
    if (!idx) {
      console.log("No legacy username index found, nothing to do.");
      process.exit(0);
    }

    console.log("Dropping index:", idx.name);
    await coll.dropIndex(idx.name);
    console.log("Index dropped successfully.");
    process.exit(0);
  } catch (err) {
    console.error(
      "Error while dropping index:",
      err && err.message ? err.message : err
    );
    process.exit(2);
  } finally {
    try {
      await mongoose.disconnect();
    } catch (e) {}
  }
}

run();
