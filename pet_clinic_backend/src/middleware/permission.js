const { ROLE_PERMISSIONS_MAP } = require("../controllers/authController");

/**
 * Middleware to enforce role-based access control on backend API routes.
 * @param  {...string} allowedRoles Roles that have access to this route
 */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    const userRole = req.user.role || "Veterinarian";

    // Super Admin has access to all routes by default
    if (userRole === "Super Admin" || allowedRoles.includes(userRole)) {
      return next();
    }

    return res.status(403).json({
      success: false,
      message: `Access denied. Role "${userRole}" does not have permission to perform this action.`,
    });
  };
}

/**
 * Middleware to check if user's role has permission for a specific module page.
 * @param {string} pageName E.g., 'billing.html', 'records.html'
 */
function requirePagePermission(pageName) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    const userRole = req.user.role || "Veterinarian";
    const allowedPages = ROLE_PERMISSIONS_MAP[userRole] || [];

    if (userRole === "Super Admin" || allowedPages.includes(pageName)) {
      return next();
    }

    return res.status(403).json({
      success: false,
      message: `Access denied. Role "${userRole}" is not permitted to access ${pageName}.`,
    });
  };
}

module.exports = { requireRole, requirePagePermission };
