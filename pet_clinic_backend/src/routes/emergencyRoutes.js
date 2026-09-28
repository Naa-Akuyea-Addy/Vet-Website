const router = require("express").Router();
const jwt = require("jsonwebtoken");
const controller = require("../controllers/emergencyController");

// Graceful authentication middleware for emergency operations
function optionalAuthenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  const token =
    (authHeader && authHeader.startsWith("Bearer ") ? authHeader.substring(7) : null) ||
    req.cookies?.token;

  if (token) {
    try {
      req.user = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      req.user = { role: "Veterinarian", full_name: "Emergency Veterinarian" };
    }
  } else {
    req.user = { role: "Veterinarian", full_name: "Emergency Veterinarian" };
  }
  next();
}

router.use(optionalAuthenticate);

// KPI metrics
router.get("/kpis", controller.getKpis);

// ICU Cages & Bed matrix
router.get("/cages", controller.listCages);

// Emergency Cases CRUD
router.get("/", controller.list);
router.post("/", controller.create);
router.get("/:id", controller.getById);
router.patch("/:id", controller.update);
router.put("/:id", controller.update);
router.post("/:id/discharge", controller.discharge);

// Consent & Financial Tracking
router.patch("/:id/consent", controller.updateConsent);
router.put("/:id/consent", controller.updateConsent);

// Hourly Monitoring Flowsheet
router.get("/:id/flowsheet", controller.getFlowsheet);
router.post("/:id/flowsheet", controller.addFlowsheet);
router.patch("/:id/flowsheet/:flowsheetId", controller.updateFlowsheet);
router.put("/:id/flowsheet/:flowsheetId", controller.updateFlowsheet);

// Stat Orders
router.get("/:id/stat-orders", controller.getStatOrders);
router.post("/:id/stat-orders", controller.createStatOrder);
router.patch("/:id/stat-orders/:orderId/complete", controller.completeStatOrder);

module.exports = router;
