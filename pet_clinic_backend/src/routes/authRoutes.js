const router = require("express").Router();
const controller = require("../controllers/authController");
const { requireBody } = require("../middleware/validation");
const { authenticate } = require("../middleware/auth");

// Login route - ACTIVE
router.post("/login", requireBody(["email", "password"]), controller.login);
router.post("/forgot-password", requireBody(["email"]), controller.requestPasswordReset);
router.post("/reset-password", requireBody(["token", "password"]), controller.resetPassword);
router.get("/profile", authenticate, controller.getCurrentProfile);
router.patch("/profile-image", authenticate, controller.updateProfileImage);

// Register route - COMMENTED OUT
// router.post(
//   "/register",
//   requireBody(["email", "password", "name", "license_number", "phone"]),
//   controller.register,
// );

module.exports = router;
