const router = require("express").Router();
const controller = require("../controllers/patientController");
const { authenticate } = require("../middleware/auth");
router
  .use(authenticate)
  .get("/", controller.list)
  .get("/:id", controller.getById);
module.exports = router;
