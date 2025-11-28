const User = require("../models/user.model");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const BlacklistedToken = require("../models/blacklistedToken.model");

// Simple registration (no OTP)
exports.register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res
        .status(400)
        .json({ message: "Tên, email và mật khẩu là bắt buộc" });
    }

    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "Email đã được đăng ký" });
    }

    const user = new User({ name, email, password, isEmailVerified: true });
    await user.save();

    const token = jwt.sign(
      { id: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    );

    return res.status(201).json({
      message: "Đăng ký thành công",
      token,
      user: { id: user._id, name: user.name, email: user.email },
    });
  } catch (error) {
    console.error("Register error:", error);
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
        name: user.name,
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
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(400).json({ message: "No token provided" });
    }
    const token = authHeader.split(" ")[1];

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
