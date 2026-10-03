const router = require("express").Router();
const controller = require("../controllers/reportController");
const { authenticate } = require("../middleware/auth");

router.use(authenticate);
router.get("/summary", controller.summary);
router.get("/insight", controller.insight);
router.post("/insights", controller.postInsights);

module.exports = router;
