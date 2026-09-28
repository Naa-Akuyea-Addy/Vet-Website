const router = require("express").Router();
const controller = require("../controllers/payrollController");

router.get("/", controller.list);
router.get("/kpis", controller.kpis);
router.get("/payslip", controller.payslip);
router.get("/reports", controller.reports);
router.patch("/:id/status", controller.updateStatus);

module.exports = router;
