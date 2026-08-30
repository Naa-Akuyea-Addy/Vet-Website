const router = require("express").Router();
const controller = require("../controllers/patientController");
const { authenticate } = require("../middleware/auth");

router.use(authenticate);
router.get("/", controller.list);
router.get("/:id", controller.findById);
router.post("/", controller.create);
router.patch("/:id", controller.update);
router.delete("/:id", controller.remove);

module.exports = router;
