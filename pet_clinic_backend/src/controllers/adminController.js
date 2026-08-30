const model = require("../models/adminModel");
const userModel = require("../models/userModel");
const { ROLE_PERMISSIONS_MAP, ROLE_REDIRECT_MAP } = require("./authController");

async function messages(req, res, next) {
  try {
    const rows = await model.listMessages();
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
}

async function roles(req, res, next) {
  try {
    // Return all system roles with their permission pages and redirect URLs
    const rolesList = Object.keys(ROLE_PERMISSIONS_MAP).map((roleName) => ({
      name: roleName,
      permissions: ROLE_PERMISSIONS_MAP[roleName] || [],
      landingPage: ROLE_REDIRECT_MAP[roleName] || "Dashboard.html",
      description: `Access to ${ROLE_PERMISSIONS_MAP[roleName].length} module(s)`,
    }));
    res.json({ success: true, data: rolesList });
  } catch (err) {
    next(err);
  }
}

async function settings(req, res, next) {
  try {
    const rows = await model.listSettings();
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
}

async function notifications(req, res, next) {
  try {
    const rows = await model.listNotifications();
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
}

// User Management Endpoints
async function listUsers(req, res, next) {
  try {
    const users = await userModel.list();
    res.json({ success: true, data: users });
  } catch (err) {
    next(err);
  }
}

async function createUser(req, res, next) {
  try {
    const { email, password, fullName, role, phone, licenseNumber, status } = req.body;

    if (!email || !password || !fullName) {
      return res.status(400).json({
        success: false,
        message: "Full name, email, and password are required.",
      });
    }

    // Validate role against allowed roles
    const validRoles = Object.keys(ROLE_PERMISSIONS_MAP);
    const assignedRole = validRoles.includes(role) ? role : "Veterinarian";

    // Check if user already exists
    const existing = await userModel.findByEmail(email);
    if (existing) {
      return res.status(409).json({
        success: false,
        message: `A user with email "${email}" already exists.`,
      });
    }

    await userModel.create({
      email,
      password,
      fullName,
      role: assignedRole,
      phone,
      licenseNumber,
      status: status || "Active",
    });

    res.status(201).json({
      success: true,
      message: `User "${fullName}" created successfully as ${assignedRole}.`,
      role: assignedRole,
      redirectUrl: ROLE_REDIRECT_MAP[assignedRole] || "/admin_portal_vet_website/Dashboard.html",
    });
  } catch (err) {
    next(err);
  }
}

async function updateUserRole(req, res, next) {
  try {
    const { id } = req.params;
    const { role } = req.body;
    if (!ROLE_PERMISSIONS_MAP[role]) {
      return res.status(400).json({
        success: false,
        message: `Invalid role "${role}". Allowed roles: ${Object.keys(ROLE_PERMISSIONS_MAP).join(", ")}`,
      });
    }
    await userModel.updateRole(id, role);
    res.json({
      success: true,
      message: `User role updated to "${role}".`,
    });
  } catch (err) {
    next(err);
  }
}

async function updateUserStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { status } = req.body;
    await userModel.updateStatus(id, status || "Active");
    res.json({
      success: true,
      message: `User status updated to "${status}".`,
    });
  } catch (err) {
    next(err);
  }
}

async function deleteUser(req, res, next) {
  try {
    const { id } = req.params;
    await userModel.remove(id);
    res.json({
      success: true,
      message: "User deleted successfully.",
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  messages,
  roles,
  settings,
  notifications,
  listUsers,
  createUser,
  updateUserRole,
  updateUserStatus,
  deleteUser,
};
