const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
  },
  password: {
    type: String,
    required: true,
    select: false, // Do not return password in queries
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  // OTP for password reset
  resetPasswordOTP: {
    type: String,
    select: false,
  },
  resetPasswordOTPExpire: {
    type: Date,
    select: false,
  },
  // Registration OTP for new users
  isEmailVerified: {
    type: Boolean,
    default: false,
  },
});

// Trong User model - thêm điều kiện để tránh hash lại
userSchema.pre("save", async function (next) {
  // Bỏ qua hash nếu password đã được hash (có độ dài 60 và bắt đầu bằng $2b$)
  if (
    !this.isModified("password") ||
    (this.password &&
      this.password.startsWith("$2b$") &&
      this.password.length === 60)
  ) {
    return next();
  }

  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// Method to compare password
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model("User", userSchema);
module.exports = User;
