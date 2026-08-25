const router = require("express").Router();
const controller = require("../controllers/billingController");
const { authenticate } = require("../middleware/auth");
router.use(authenticate);
router.get("/", controller.list);
router.post("/", controller.create);
module.exports = router;
