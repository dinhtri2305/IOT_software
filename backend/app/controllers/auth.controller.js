const User = require("../models/user.model");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const BlacklistedToken = require("../models/blackListedToken.model");
const PendingUser = require("../models/pendingUser.model");
const sendEmail = require("../../utils/sendEmail");

// Registration: create pending user and send OTP (email, password, confirmPassword)
exports.register = async (req, res) => {
  try {
    const { email, password, confirmPassword } = req.body;

    if (!email || !password || !confirmPassword) {
      return res
        .status(400)
        .json({ message: "Email, password và confirmPassword là bắt buộc" });
    }

    if (password !== confirmPassword) {
      return res
        .status(400)
        .json({ message: "Password và confirmPassword không khớp" });
    }

    // Check if a real user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "Email đã được đăng ký" });
    }

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Remove any previous pending entry for this email
    await PendingUser.findOneAndDelete({ email });

    // For simplicity we store the plain password temporarily. In production
    // prefer hashing or using a verification token flow.
    await PendingUser.create({ email, password, otp, otpExpiresAt });

    // Try to send OTP by email; fall back to returning OTP in response for dev
    try {
      await sendEmail({
        to: email,
        subject: "Your registration OTP",
        text: `OTP: ${otp}`,
      });
    } catch (e) {
      // ignore send errors for now
    }

    return res.status(200).json({
      success: true,
      message: "OTP sent to email (or returned in response for dev)",
      otp,
    });
  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Verify registration OTP and create the real user
exports.verifyRegistrationOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp)
      return res.status(400).json({ message: "Email và otp là bắt buộc" });

    const pending = await PendingUser.findOne({ email });
    if (!pending)
      return res
        .status(400)
        .json({ message: "No pending signup for this email" });

    if (
      pending.otp !== String(otp) ||
      !pending.otpExpiresAt ||
      pending.otpExpiresAt < new Date()
    ) {
      return res.status(400).json({ message: "OTP invalid or expired" });
    }

    // Create real user. No username/name fields — keep user minimal.
    const user = new User({
      email: pending.email,
      password: pending.password,
      isEmailVerified: true,
    });
    await user.save();

    // Remove pending
    await PendingUser.deleteOne({ email });

    const token = jwt.sign(
      { id: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    );

    return res.status(201).json({
      message: "Registration verified",
      token,
      user: { id: user._id, email: user.email },
    });
  } catch (error) {
    console.error("verifyRegistrationOTP error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Login user - Fixed version
// Login user - Debug version
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // console.log('Login attempt for:', email);
    // console.log('Password provided:', password);

    if (!email || !password) {
      return res.status(400).json({ message: "Email và mật khẩu là bắt buộc" });
    }

    // Find user and include password field
    const user = await User.findOne({ email }).select("+password");
    // console.log('User found:', user ? 'Yes' : 'No');

    if (!user) {
      console.log("User not found for email:", email);
      return res
        .status(400)
        .json({ message: "Email hoặc mật khẩu không đúng" });
    }

    // console.log('Stored password hash:', user.password);
    // console.log('Password length:', user.password ? user.password.length : 'undefined');

    // Verify password using bcrypt.compare directly
    const isMatch = await bcrypt.compare(password, user.password);
    // console.log('Password match result:', isMatch);

    if (!isMatch) {
      // console.log('Password mismatch for user:', email);
      return res
        .status(400)
        .json({ message: "Email hoặc mật khẩu không đúng" });
    }

    // Generate token
    const token = jwt.sign(
      { id: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    );

    res.status(200).json({
      message: "Đăng nhập thành công",
      token,
      user: {
        id: user._id,
        email: user.email,
        isEmailVerified: user.isEmailVerified,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// logout user (giữ nguyên)
exports.logout = async (req, res) => {
  try {
    // Accept token from Authorization header, body or query for flexibility
    let token;
    if (
      req.headers &&
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }
    if (!token && req.body && req.body.token) token = req.body.token;
    if (!token && req.query && req.query.token) token = req.query.token;

    if (!token) {
      return res.status(400).json({ message: "No token provided" });
    }

    // Decode token to get expiration time
    const decoded = jwt.decode(token);
    if (!decoded || !decoded.exp) {
      return res.status(400).json({ message: "Invalid token" });
    }
    const expiresAt = new Date(decoded.exp * 1000);

    // save token to blacklist
    await BlacklistedToken.create({ token, expiresAt });

    return res.status(200).json({ message: "Logout successful" });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};
