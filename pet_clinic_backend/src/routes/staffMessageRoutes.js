const router = require("express").Router();
const controller = require("../controllers/staffMessageController");

router.get("/", controller.list);
router.get("/conversations", controller.conversations);
router.post("/", controller.create);
router.patch("/read", controller.markRead);

module.exports = router;
