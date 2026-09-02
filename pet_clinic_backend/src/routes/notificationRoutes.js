const router = require("express").Router();
const controller = require("../controllers/notificationController");
const { authenticate } = require("../middleware/auth");

router.use(authenticate);
router.get("/", controller.list);
router.patch("/read-all", controller.readAll);
router.patch("/:id/read", controller.read);

module.exports = router;
