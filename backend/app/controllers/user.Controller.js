const User = require("../models/user.model");
const bcrypt = require("bcryptjs");
// sendEmail not required for local OTP simulation
const mongoose = require("mongoose");
// Get all users
exports.getAllUsers = async (req, res, next) => {
  try {
    let query = User.find();

    // No role-based filtering: return all users (excluding password)

    // Thực hiện query và loại bỏ password
    const users = await query.select("-password");

    res.status(200).json({
      success: true,
      count: users.length,
      data: users,
    });
  } catch (error) {
    next(error);
  }
};

// Get single user
exports.getUser = async (req, res, next) => {
  try {
    const identifier = req.params.id; // có thể là ID hoặc email
    let user;

    // Kiểm tra xem identifier có phải là email không
    if (identifier.includes("@")) {
      user = await User.findOne({ email: identifier }).select("-password");
    } else {
      // Nếu không phải email thì tìm bằng ID
      // Check if identifier is a valid MongoDB ObjectId
      if (!mongoose.Types.ObjectId.isValid(identifier)) {
        const error = new Error("Invalid user ID format");
        error.statusCode = 400;
        return next(error);
      }
      user = await User.findById(identifier).select("-password");
    }

    if (!user) {
      const error = new Error("User not found");
      error.statusCode = 404;
      return next(error);
    }

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    // Nếu ID không hợp lệ
    if (error.name === "CastError") {
      const customError = new Error("Invalid user ID format");
      customError.statusCode = 400;
      return next(customError);
    }
    next(error);
  }
};

// Create new user
exports.createUser = async (req, res, next) => {
  try {
    const user = await User.create(req.body);

    res.status(201).json({
      success: true,
      data: user,
    });
  } catch (error) {
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((val) => val.message);
      error.statusCode = 400;
      error.message = messages;
    } else if (error.code === 11000) {
      error.statusCode = 400;
      error.message = "Email already exists";
    }
    next(error);
  }
};

// Update user
exports.updateUser = async (req, res, next) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    }).select("-password");
    // select('-password') thực hiện lọc trường password ra khỏi kết quả trả về

    if (!user) {
      const error = new Error("User not found");
      error.statusCode = 404;
      throw error;
    }

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

// Delete user
exports.deleteUser = async (req, res, next) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);

    if (!user) {
      const error = new Error("User not found");
      error.statusCode = 404;
      throw error;
    }

    res.status(200).json({
      success: true,
      data: {},
    });
  } catch (error) {
    next(error);
  }
};

const matchPassword = async (user, password) => {
  return await bcrypt.compare(password, user.password);
};

// login
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Tìm người dùng
    const user = await User.findOne({ email }).select("+password");
    if (!user) {
      return res
        .status(401)
        .json({ message: "Email hoặc mật khẩu không đúng" });
    }

    // Kiểm tra mật khẩu
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res
        .status(401)
        .json({ message: "Email hoặc mật khẩu không đúng" });
    }

    // Create token
    const jwt = require("jsonwebtoken");
    const token = jwt.sign(
      { id: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    );

    res.status(200).json({
      success: true,
      token,
      user: {
        id: user._id,
        email: user.email,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Quên mật khẩu - Yêu cầu OTP
exports.forgotPassword = async (req, res, next) => {
  let user;
  try {
    user = await User.findOne({ email: req.body.email });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy tài khoản với email này",
      });
    }

    // Tạo OTP 6 số
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Hash OTP và set thời hạn
    user.resetPasswordOTP = await bcrypt.hash(otp, 10);
    user.resetPasswordOTPExpire = Date.now() + 10 * 60 * 1000; // 10 phút

    await user.save({ validateBeforeSave: false });

    // Development: log OTP and return it in response for simulation (no SMTP)
    console.log(`OTP for ${user.email}: ${otp}`);

    // Do not return the OTP in the HTTP response to avoid leaking secrets.
    // Still log it on the server in development for debugging.
    res.status(200).json({
      success: true,
      message: "OTP đã được tạo. Vui lòng kiểm tra email của bạn.",
    });
  } catch (error) {
    // Only try to reset OTP fields if user was found
    if (user) {
      user.resetPasswordOTP = undefined;
      user.resetPasswordOTPExpire = undefined;
      await user.save({ validateBeforeSave: false });
    }
    next(error);
  }
};

// Kiểm tra OTP
exports.verifyOTP = async (req, res, next) => {
  try {
    const { email, otp } = req.body;

    // Tìm user với email và OTP chưa hết hạn
    const user = await User.findOne({
      email,
      resetPasswordOTPExpire: { $gt: Date.now() },
    }).select("+resetPasswordOTP");

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "OTP đã hết hạn hoặc email không hợp lệ",
      });
    }

    // Verify OTP
    const isValidOTP = await bcrypt.compare(otp, user.resetPasswordOTP);
    if (!isValidOTP) {
      return res.status(400).json({
        success: false,
        message: "OTP không chính xác",
      });
    }

    // Tạo một token tạm thời để xác nhận OTP đã được kiểm tra
    const jwt = require("jsonwebtoken");
    const resetToken = jwt.sign(
      { id: user._id, email: user.email, isPasswordReset: true },
      process.env.JWT_SECRET,
      { expiresIn: "15m" }
    );

    // Trả về resetToken trong body
    res.status(200).json({
      success: true,
      message: "OTP hợp lệ",
      resetToken,
    });
  } catch (error) {
    next(error);
  }
};

// Reset Password sau khi OTP đã được xác thực
// Nhận email, newPassword và resetToken từ body (hoặc resetToken từ headers)
exports.resetPassword = async (req, res, next) => {
  try {
    const { email, newPassword, resetToken: bodyResetToken } = req.body;

    if (!email || !newPassword) {
      return res
        .status(400)
        .json({ success: false, message: "Email và newPassword là bắt buộc" });
    }

    // Verify email từ body khớp với email trong resetToken
    if (req.resetUser && req.resetUser.email !== email) {
      return res.status(400).json({
        success: false,
        message: "Email không khớp với reset token",
      });
    }

    // Tìm user với email từ body
    const user = await User.findOne({ email }).select("+resetPasswordOTP");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy tài khoản với email này",
      });
    }

    // Set mật khẩu mới
    user.password = newPassword;
    user.resetPasswordOTP = undefined;
    user.resetPasswordOTPExpire = undefined;

    await user.save();

    res.status(200).json({
      success: true,
      message: "Mật khẩu đã được đổi thành công",
    });
  } catch (error) {
    next(error);
  }
};
