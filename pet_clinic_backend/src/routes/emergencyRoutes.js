const router = require("express").Router();
const controller = require("../controllers/emergencyController");
const { authenticate } = require("../middleware/auth");
router.use(authenticate).get("/", controller.list).post("/", controller.create);
module.exports = router;
