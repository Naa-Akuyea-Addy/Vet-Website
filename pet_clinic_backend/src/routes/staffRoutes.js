const router = require("express").Router();
const controller = require("../controllers/staffController");
const { authenticate } = require("../middleware/auth");
router.use(authenticate).get("/", controller.list);
module.exports = router;
