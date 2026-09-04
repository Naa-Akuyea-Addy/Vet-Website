const router = require("express").Router();
const controller = require("../controllers/recurringBlockController");
const { authenticate } = require("../middleware/auth");

router.use(authenticate);
router.get("/", controller.list);
router.post("/", controller.create);
router.delete("/:id", controller.remove);

module.exports = router;
