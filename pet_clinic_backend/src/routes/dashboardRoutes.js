const router = require("express").Router();
const controller = require("../controllers/dashboardController");

// Accessible for dashboard stats
router.get("/stats", controller.getStats);
router.get("/dashboard", controller.getStats);
router.get("/", controller.getStats);

module.exports = router;
