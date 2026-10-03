const express = require("express");
const router = express.Router();
const mortuaryController = require("../controllers/mortuaryController");
const { authenticate } = require("../middleware/auth");

// Apply authentication middleware to all mortuary routes
router.use(authenticate);

router.get("/", mortuaryController.getAllMortuaryRecords);
router.post("/", mortuaryController.createMortuaryRecord);
router.put("/:id", mortuaryController.updateMortuaryRecord);
router.delete("/:id", mortuaryController.deleteMortuaryRecord);

module.exports = router;
