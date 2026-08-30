const { ROLE_PERMISSIONS_MAP } = require("../controllers/authController");

function requireBody(fields) {
  return (req, res, next) => {
    const missing = fields.filter(
      (field) => req.body?.[field] === undefined || req.body[field] === "",
    );
    if (missing.length) {
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missing.join(", ")}`,
      });
    }
    next();
  };
}

function validateEmail(req, res, next) {
  const { email } = req.body;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({
      success: false,
      message: "Please provide a valid email address.",
    });
  }
  next();
}

function validateUserRole(req, res, next) {
  const { role } = req.body;
  const validRoles = Object.keys(ROLE_PERMISSIONS_MAP);
  if (role && !validRoles.includes(role)) {
    return res.status(400).json({
      success: false,
      message: `Invalid role "${role}". Allowed roles: ${validRoles.join(", ")}`,
    });
  }
  next();
}

module.exports = { requireBody, validateEmail, validateUserRole };
