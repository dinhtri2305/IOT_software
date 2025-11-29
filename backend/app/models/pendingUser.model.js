const mongoose = require("mongoose");

const pendingUserSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, trim: true },
    // NOTE: For simplicity this stores the plain password temporarily until
    // the user verifies the OTP and the account is created. In production
    // prefer storing a bcrypt hash or using a separate verification token.
    password: { type: String, required: true },
    otp: { type: String },
    otpExpiresAt: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model("PendingUser", pendingUserSchema);
