const router = require("express").Router();
const controller = require("../controllers/reportController");
const { authenticate } = require("../middleware/auth");
router.use(authenticate).get("/summary", controller.summary);
module.exports = router;
