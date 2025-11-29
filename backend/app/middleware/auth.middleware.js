const jwt = require("jsonwebtoken");
const User = require("../models/user.model");
const BlacklistedToken = require("../models/blackListedToken.model");

const extractToken = (req) => {
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer ")
  ) {
    return req.headers.authorization.split(" ")[1];
  }
  return null;
};

exports.protect = async (req, res, next) => {
  try {
    const token = extractToken(req);

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Không có token. Vui lòng đăng nhập.",
      });
    }

    // Check blacklist
    const revoked = await BlacklistedToken.findOne({ token });
    if (revoked) {
      return res
        .status(401)
        .json({
          success: false,
          message: "Token đã bị thu hồi. Vui lòng đăng nhập lại.",
        });
    }

    // Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      // Token hết hạn
      if (err.name === "TokenExpiredError") {
        return res
          .status(401)
          .json({
            success: false,
            message: "Token hết hạn. Vui lòng đăng nhập lại.",
          });
      }

      return res.status(401).json({
        success: false,
        message: "Token không hợp lệ.",
      });
    }

    // Reset token không được dùng cho các route bình thường
    if (decoded.isPasswordReset) {
      return res.status(401).json({
        success: false,
        message: "Reset token không dùng để truy cập trang này.",
      });
    }

    // Check user
    const user = await User.findById(decoded.id).select("+currentAuthToken");

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Không tìm thấy người dùng.",
      });
    }

    // Check account active
    if (user.isActive === false) {
      return res.status(401).json({
        success: false,
        message: "Tài khoản đã bị vô hiệu hoá.",
      });
    }

    // Check single-session
    if (user.currentAuthToken && user.currentAuthToken !== token) {
      return res.status(401).json({
        success: false,
        message: "Phiên đăng nhập đã bị thay đổi. Vui lòng đăng nhập lại.",
      });
    }

    // Attached to request
    req.user = {
      id: user._id,
      email: user.email,
    };

    next();
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Lỗi xác thực",
      error: err.message,
    });
  }
};

// Simplified, only check logged-in
exports.admin = (req, res, next) => {
  if (req.user) return next();
  return res
    .status(403)
    .json({ success: false, message: "Không có quyền truy cập" });
};

// No op
exports.authorize = () => (req, res, next) => {
  if (!req.user) {
    return res
      .status(401)
      .json({ success: false, message: "Không được phép truy cập" });
  }
  next();
};

// Reset token middleware
exports.authorizePasswordReset = (req, res, next) => {
  try {
    const token = extractToken(req);
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Thiếu reset token",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (!decoded || !decoded.isPasswordReset) {
      return res.status(401).json({
        success: false,
        message: "Reset token không hợp lệ",
      });
    }

    req.resetUser = { id: decoded.id, email: decoded.email };
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: "Reset token hết hạn hoặc không hợp lệ",
      error: err.message,
    });
  }
};
