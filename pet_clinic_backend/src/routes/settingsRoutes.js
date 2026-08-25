const router = require("express").Router();
const controller = require("../controllers/settingsController");
const { authenticate } = require("../middleware/auth");
router.use(authenticate).get("/", controller.get).put("/", controller.update);
module.exports = router;
