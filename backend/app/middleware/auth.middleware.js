const jwt = require("jsonwebtoken");
const User = require("../models/user.model");
const BlacklistedToken = require("../models/blackListedToken.model");

// Protect routes - check if user is authenticated
exports.protect = async (req, res, next) => {
  try {
    let token;

    // Check if token exists in headers
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Not authorized, please login",
      });
    }

    // Check if token is blacklisted (logged out)
    const found = await BlacklistedToken.findOne({ token });
    if (found) {
      return res
        .status(401)
        .json({ success: false, message: "Token revoked, please login" });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Get user from token
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found",
      });
    }

    // Only block if account is explicitly deactivated (false).
    if (user.isActive === false) {
      return res.status(401).json({
        success: false,
        message: "Account is deactivated",
      });
    }

    // Attach user to request (only necessary fields)
    req.user = {
      id: user._id,
      email: user.email,
    };

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Not authorized, token failed",
      error: error.message,
    });
  }
};

// Remove role-based admin checks — simplified: only require authentication
exports.admin = (req, res, next) => {
  // Deprecated: treat as protected route for authenticated users
  if (req.user) return next();
  return res.status(403).json({ success: false, message: "Not authorized" });
};

// authorize is now a no-op wrapper that only ensures authentication
exports.authorize = () => {
  return (req, res, next) => {
    if (!req.user) {
      return res
        .status(401)
        .json({ success: false, message: "Not authorized" });
    }
    next();
  };
};

// Middleware to authorize password reset using a short-lived reset token
exports.authorizePasswordReset = (req, res, next) => {
  try {
    let token;
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }
    if (!token) {
      return res
        .status(401)
        .json({ success: false, message: "Reset token missing" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded || !decoded.isPasswordReset) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid reset token" });
    }

    // Attach reset info for handler (email or id)
    req.resetUser = { id: decoded.id, email: decoded.email };
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired reset token",
      error: err.message,
    });
  }
};
