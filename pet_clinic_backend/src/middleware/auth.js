const jwt = require("jsonwebtoken");

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  const token =
    (authHeader && authHeader.startsWith("Bearer ") ? authHeader.substring(7) : null) ||
    req.cookies?.token;

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Authentication required. Please log in to access this resource.",
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired session token. Please log in again.",
    });
  }
}

module.exports = { authenticate };
