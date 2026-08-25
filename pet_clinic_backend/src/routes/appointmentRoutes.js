const router = require("express").Router();
const controller = require("../controllers/appointmentController");
const { authenticate } = require("../middleware/auth");
router.use(authenticate);
router.get("/", controller.list);
router.post("/", controller.create);
module.exports = router;
