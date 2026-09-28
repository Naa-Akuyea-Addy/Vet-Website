const router = require("express").Router();
const controller = require("../controllers/appointmentController");
const { authenticate } = require("../middleware/auth");
const jwt = require("jsonwebtoken");

function optionalAuthenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  const token =
    (authHeader && authHeader.startsWith("Bearer ") ? authHeader.substring(7) : null) ||
    req.cookies?.token;

  if (token) {
    try {
      req.user = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {}
  }
  next();
}

router.get("/", optionalAuthenticate, controller.list);
router.use(authenticate);
router.get("/:id", controller.get);
router.post("/", controller.create);
router.post("/reply-enquiry", controller.sendEnquiryReply);
router.put("/:id", controller.update);
router.patch("/:id", controller.update);
router.patch("/:id/status", controller.updateStatus);
router.delete("/:id", controller.remove);

module.exports = router;

