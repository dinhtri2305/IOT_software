// const express = require("express");
// const router = express.Router();
// const authController = require("../controllers/auth.controller");
// const { protect } = require("../middleware/auth.middleware");

// // POST /api/auth/register - Register new user
// // Body: { "username": "...", "email": "...", "password": "..." }
// router.post("/register", authController.register);

// // POST /api/auth/login - Login user
// // Body: { "email": "...", "password": "..." }
// router.post("/login", authController.login);

// // Protected routes (require authentication)
// router.use(protect);

// // GET /api/auth/profile - Get current user profile
// router.get("/profile", authController.getProfile);

// // PUT /api/auth/profile - Update user profile
// // Body: { "username": "...", "email": "..." }
// router.put("/profile", authController.updateProfile);

// // PUT /api/auth/change-password - Change password
// // Body: { "currentPassword": "...", "newPassword": "..." }
// router.put("/change-password", authController.changePassword);

// module.exports = router;
// routes/authRoutes.js
const express = require("express");
const router = express.Router();
const { register, login, logout } = require("../controllers/auth.controller");

// define endpoints
router.post("/register", register);
// Note: OTP-registration flow removed; no verify-registration-otp endpoint
router.post("/login", login);
router.post("/logout", logout);

module.exports = router;
