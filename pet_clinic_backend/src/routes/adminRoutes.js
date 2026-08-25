const router = require("express").Router();
const controller = require("../controllers/adminController");
const { authenticate } = require("../middleware/auth");

router.use(authenticate);
router.get("/messages", controller.messages);
router.get("/roles", controller.roles);
router.get("/settings", controller.settings);
router.get("/notifications", controller.notifications);

module.exports = router;
