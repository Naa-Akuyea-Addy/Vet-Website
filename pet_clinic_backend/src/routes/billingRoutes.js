const router = require("express").Router();
const controller = require("../controllers/billingController");

router.get("/", controller.list);
router.post("/", controller.create);
router.patch("/:id/status", controller.updateStatus);
router.delete("/:id", controller.remove);

module.exports = router;
