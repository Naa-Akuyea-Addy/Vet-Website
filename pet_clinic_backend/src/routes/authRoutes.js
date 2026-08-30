const router = require("express").Router();
const controller = require("../controllers/authController");
const { requireBody } = require("../middleware/validation");

// Login route - ACTIVE
router.post("/login", requireBody(["email", "password"]), controller.login);

// Register route - COMMENTED OUT
// router.post(
//   "/register",
//   requireBody(["email", "password", "name", "license_number", "phone"]),
//   controller.register,
// );

module.exports = router;
