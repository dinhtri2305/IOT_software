// app/models/user.model.js
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, "Username is required"],
      unique: true,
      trim: true,
      minlength: [3, "Username must be at least 3 characters"],
      maxlength: [30, "Username cannot exceed 30 characters"],
      lowercase: true,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      trim: true,
      lowercase: true,
      match: [
        /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,6})+$/,
        "Please provide a valid email address",
      ],
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [6, "Password must be at least 6 characters"],
      select: false, // Không trả về password khi query
    },
    role: {
      type: String,
      enum: ["user", "admin", "superadmin"],
      default: "user",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastLogin: {
      type: Date,
    },
    loginAttempts: {
      type: Number,
      default: 0,
      select: false,
    },
    lockUntil: {
      type: Date,
      select: false,
    },
    // Password reset
    resetPasswordToken: String,
    resetPasswordExpire: Date,
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ==================== INDEXES ====================
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ username: 1 }, { unique: true });
userSchema.index({ role: 1 });

// ==================== PRE-SAVE: MÃ HÓA MẬT KHẨU ====================
userSchema.pre("save", async function (next) {
  // Chỉ hash nếu password được thay đổi
  if (!this.isModified("password")) return next();

  try {
    const salt = await bcrypt.genSalt(12); // Tăng từ 10 → 12 cho bảo mật cao hơn
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

// ==================== INSTANCE METHODS ====================
// So sánh mật khẩu
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Tạo JWT token
userSchema.methods.generateToken = function (expiresIn = "7d") {
  return jwt.sign(
    {
      id: this._id,
      username: this.username,
      email: this.email,
      role: this.role,
    },
    process.env.JWT_SECRET,
    { expiresIn: expiresIn || process.env.JWT_EXPIRE || "7d" }
  );
};

// Tạo token reset password
userSchema.methods.getResetPasswordToken = function () {
  const resetToken = crypto.randomBytes(20).toString("hex");

  // Hash token và lưu vào DB
  this.resetPasswordToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");

  // Hết hạn sau 10 phút
  this.resetPasswordExpire = Date.now() + 10 * 60 * 1000;

  return resetToken; // Gửi cho user qua email
};

// Kiểm tra tài khoản có bị khóa không
userSchema.methods.isLocked = function () {
  return this.lockUntil && this.lockUntil > Date.now();
};

// Tăng số lần đăng nhập sai
userSchema.methods.incLoginAttempts = function () {
  // Nếu đã bị khóa và chưa hết hạn → giữ nguyên lockUntil
  if (this.lockUntil && this.lockUntil > Date.now()) {
    return this.save();
  }

  const attempts = this.loginAttempts + 1;

  // Khóa tài khoản sau 5 lần sai (1 giờ)
  if (attempts >= 5) {
    this.lockUntil = Date.now() + 60 * 60 * 1000;
  }

  this.loginAttempts = attempts;
  return this.save();
};

// Reset login attempts sau khi đăng nhập thành công
userSchema.methods.resetLoginAttempts = function () {
  this.loginAttempts = 0;
  this.lockUntil = null;
  return this.save();
};

// ==================== VIRTUAL ====================
userSchema.virtual("isAdmin").get(function () {
  return this.role === "admin" || this.role === "superadmin";
});

const User = mongoose.model("User", userSchema);

module.exports = User;
