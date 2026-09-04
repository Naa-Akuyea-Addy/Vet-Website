const router = require("express").Router();
const controller = require("../controllers/doctorAvailabilityController");
const { authenticate } = require("../middleware/auth");

router.use(authenticate);
router.get("/", controller.list);
router.patch("/:staffId", controller.update);

module.exports = router;
