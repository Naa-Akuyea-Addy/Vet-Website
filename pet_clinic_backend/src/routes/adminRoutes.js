const router = require("express").Router();
const controller = require("../controllers/adminController");
const { authenticate } = require("../middleware/auth");

// Public/semi-protected routes (can be accessed with auth)
router.use(authenticate);

router.get("/messages", controller.messages);
router.get("/roles", controller.roles);
router.get("/settings", controller.settings);
router.get("/notifications", controller.notifications);

// User Management Routes
router.get("/users", controller.listUsers);
router.post("/users", controller.createUser);
router.patch("/users/:id/role", controller.updateUserRole);
router.patch("/users/:id/status", controller.updateUserStatus);
router.delete("/users/:id", controller.deleteUser);

module.exports = router;
