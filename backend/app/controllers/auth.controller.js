const User = require("../models/user.model");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const BlacklistedToken = require("../models/blackListedToken.model");
const PendingUser = require("../models/pendingUser.model");
const sendEmail = require("../../utils/sendEmail");

// Registration: create pending user and send OTP (name, email, password)
exports.register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res
        .status(400)
        .json({ message: "Name, email và password là bắt buộc" });
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
    await PendingUser.create({ name, email, password, otp, otpExpiresAt });

    // Decide if we should run in dev mode and skip sending email entirely.
    // If FORCE_DEV_OTP=true or not in production, skip calling sendEmail to avoid SMTP errors.
    const forceDev = process.env.FORCE_DEV_OTP === "true";
    const skipEmail = forceDev || process.env.NODE_ENV !== "production";

    let sendResult = null;
    if (skipEmail) {
      // Do not attempt SMTP in dev/testing; mark as dev so OTP is returned below
      sendResult = { dev: true };
      console.log(
        "register: skipping sendEmail (dev/testing or FORCE_DEV_OTP=true)"
      );
    } else {
      try {
        sendResult = await sendEmail({
          to: email,
          subject: "Your registration OTP",
          text: `OTP: ${otp}`,
        });
      } catch (e) {
        // If sending fails, log and fall back to dev behavior (returning OTP)
        console.warn("sendEmail failed for registration OTP:", e.message);
        sendResult = null;
      }
    }

    // Decide whether to return OTP in response:
    // - explicit override: FORCE_DEV_OTP=true
    // - development mode (NODE_ENV !== 'production')
    // - sendEmail indicated dev mode (sendResult.dev)
    // - sendEmail failed (sendResult is null/undefined)
    const isDev =
      forceDev ||
      process.env.NODE_ENV !== "production" ||
      (sendResult && sendResult.dev) ||
      !sendResult;

    if (!sendResult) {
      console.warn(
        "register: sendEmail failed or was skipped; returning OTP in response for dev/testing"
      );
    }

    // For development/testing: print the OTP to the server console so devs can see it
    if (isDev) {
      console.log(`Registration OTP for ${email}: ${otp}`);
    }

    return res.status(200).json({
      success: true,
      message: "OTP generated for registration",
      ...(isDev ? { otp } : {}),
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

    // Create real user with name field
    const user = new User({
      name: pending.name,
      email: pending.email,
      password: pending.password,
      isEmailVerified: true,
    });
    await user.save();

    // Remove pending
    await PendingUser.deleteOne({ email });

    // Do NOT return an authentication token here. User has only verified email/OTP;
    // require explicit login to obtain an auth token.
    return res.status(201).json({
      message: "Registration verified. Please login to continue.",
      user: { id: user._id, name: user.name, email: user.email },
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
    const clientId = req.clientId || null;

    // console.log('Login attempt for:', email);
    // console.log('Password provided:', password);

    if (!email || !password) {
      return res.status(400).json({ message: "Email và mật khẩu là bắt buộc" });
    }

    // Find user and include password and currentAuthToken fields
    const user = await User.findOne({ email }).select(
      "+password +currentAuthToken"
    );
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

    // If the request already carries an Authorization token for a different user,
    // block switching accounts until that token is logged out. This prevents
    // silently switching users in the same client without logout.
    let incomingAuthToken = null;
    if (
      req.headers &&
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      incomingAuthToken = req.headers.authorization.split(" ")[1];
    }

    if (incomingAuthToken) {
      try {
        const incomingDecoded = jwt.verify(
          incomingAuthToken,
          process.env.JWT_SECRET
        );
        // If the incoming token has been blacklisted (logout), ignore it and allow login
        const blacklisted = await BlacklistedToken.findOne({
          token: incomingAuthToken,
        });
        if (
          !blacklisted &&
          incomingDecoded &&
          incomingDecoded.id &&
          String(incomingDecoded.id) !== String(user._id)
        ) {
          // There's an active session for a different user on this client
          return res.status(400).json({
            message:
              "Already authenticated as a different user. Please logout before switching accounts.",
          });
        }
      } catch (e) {
        // incoming token invalid/expired -> ignore and allow login to proceed
      }
    }

    // Enforce single-session per client: if this client already has a different
    // active user session, block switching accounts until that client logs out.
    if (clientId) {
      const other = await User.findOne({ currentClientId: clientId }).select(
        "+currentAuthToken +email"
      );
      if (other && String(other._id) !== String(user._id)) {
        // If the other user's currentAuthToken is still valid and not blacklisted,
        // prevent switching accounts on this client.
        try {
          const ok = jwt.verify(other.currentAuthToken, process.env.JWT_SECRET);
          const isBlacklisted = await BlacklistedToken.findOne({
            token: other.currentAuthToken,
          });
          if (ok && !isBlacklisted) {
            return res.status(400).json({
              message:
                "This client already has an active logged-in account. Please logout first.",
            });
          }
        } catch (e) {
          // other token invalid/expired — allow login
        }
      }
    }

    // Enforce single-session: if user already has an active currentAuthToken, block login
    if (user.currentAuthToken) {
      try {
        jwt.verify(user.currentAuthToken, process.env.JWT_SECRET);
        // If verification succeeds, token is still valid — require logout first
        return res.status(400).json({
          message:
            "User already logged in. Logout first to create a new session.",
        });
      } catch (e) {
        // old token invalid/expired — allow login
      }
    }

    // Generate token
    const token = jwt.sign(
      { id: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    );

    // Save active token to user document (single-session enforcement)
    try {
      user.currentAuthToken = token;
      if (clientId) user.currentClientId = clientId;
      await user.save({ validateBeforeSave: false });
    } catch (e) {
      console.warn("Could not save currentAuthToken on login:", e.message);
    }

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

    // If token already blacklisted, treat logout as idempotent: still try to
    // clear user's currentAuthToken if needed, then inform client that token
    // was already revoked.
    try {
      const existing = await BlacklistedToken.findOne({ token });
      if (existing) {
        // Try to clear user's currentAuthToken if it still matches
        try {
          if (decoded && decoded.id) {
            const u = await User.findById(decoded.id).select(
              "+currentAuthToken"
            );
            if (u && u.currentAuthToken === token) {
              u.currentAuthToken = null;
              u.currentClientId = null;
              await u.save({ validateBeforeSave: false });
            }
          }
        } catch (e) {
          console.warn(
            "logout: failed to clear user.currentAuthToken on idempotent logout",
            e.message
          );
        }

        return res
          .status(200)
          .json({ message: "Token already revoked (idempotent logout)" });
      }
    } catch (e) {
      console.warn(
        "logout: error checking existing blacklist entry",
        e.message
      );
    }

    // save token to blacklist (upsert to avoid race duplicate-key)
    try {
      await BlacklistedToken.updateOne(
        { token },
        { $setOnInsert: { token, expiresAt } },
        { upsert: true }
      );
    } catch (e) {
      console.error("Failed to add token to blacklist:", e.message);
      throw e;
    }

    // Also clear currentAuthToken on the user if it matches this token
    try {
      if (decoded && decoded.id) {
        const u = await User.findById(decoded.id).select("+currentAuthToken");
        if (u && u.currentAuthToken === token) {
          u.currentAuthToken = null;
          u.currentClientId = null;
          await u.save({ validateBeforeSave: false });
        }
      }
    } catch (e) {
      console.warn("logout: failed to clear user.currentAuthToken", e.message);
    }

    return res.status(200).json({ message: "Logout successful" });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};
