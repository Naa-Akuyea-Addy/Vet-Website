const router = require("express").Router();
const controller = require("../controllers/authController");
const { requireBody } = require("../middleware/validation");
router.post("/login", requireBody(["email", "password"]), controller.login);
router.post(
  "/register",
  requireBody(["email", "password", "name", "license_number", "phone"]),
  controller.register,
);
module.exports = router;
