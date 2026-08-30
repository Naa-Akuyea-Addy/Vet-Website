const userModel = require("../models/userModel");
const {
  comparePassword,
  createToken,
  hashPassword,
} = require("../services/authService");

// ============================================
// Role → Page Redirect Map & Permissions
// ============================================
const ROLE_REDIRECT_MAP = {
  "Super Admin": "/admin_portal_vet_website/Dashboard.html",
  "Admin": "/admin_portal_vet_website/Dashboard.html",
  "Veterinarian": "/admin_portal_vet_website/emergency_management.html",
  "Accountant": "/admin_portal_vet_website/billing.html",
  "InventoryManager": "/admin_portal_vet_website/inventory.html",
  "Receptionist": "/admin_portal_vet_website/clinic_calendar.html",
  "Technician": "/admin_portal_vet_website/records.html",
};

const ROLE_PERMISSIONS_MAP = {
  "Super Admin": [
    "Dashboard.html",
    "appointment.html",
    "billing.html",
    "clinic_calendar.html",
    "emergency_management.html",
    "inventory.html",
    "message.html",
    "mortuary.html",
    "records.html",
    "report.html",
    "settings.html",
    "staff_service_settings.html",
  ],
  "Admin": [
    "Dashboard.html",
  ],
  "Veterinarian": [
    "emergency_management.html",
    "clinic_calendar.html",
    "records.html",
    "staff_service_settings.html",
  ],
  "Accountant": [
    "billing.html",
  ],
  "InventoryManager": [
    "inventory.html",
  ],
  "Receptionist": [
    "clinic_calendar.html",
    "appointment.html",
  ],
  "Technician": [
    "records.html",
  ],
};

function getRedirectUrl(role) {
  return ROLE_REDIRECT_MAP[role] || "/admin_portal_vet_website/Dashboard.html";
}

function getPermissions(role) {
  return ROLE_PERMISSIONS_MAP[role] || ["Dashboard.html"];
}

async function login(req, res) {
  const { email, password } = req.body;
  
  // Get user with role from database
  const user = await userModel.findByEmail(email);
  
  // Check if user exists and password is correct
  if (!user || !(await comparePassword(password, user.PASSWORD_HASH))) {
    return res.status(401).json({ 
      success: false,                              // ← NEW: Added success flag
      message: "Invalid email or password" 
    });
  }
  
  // ============================================
  // NEW: Check if user account is active
  // ============================================
  if (user.STATUS !== 'Active') {
    return res.status(403).json({
      success: false,
      message: "Account is inactive. Please contact administrator."
    });
  }
  
  // ============================================
  // NEW: Get role from user object (from database)
  // ============================================
  const role = user.ROLE || 'Veterinarian';
  
  // ============================================
  // NEW: Get redirect URL based on role
  // ============================================
  const redirectUrl = getRedirectUrl(role);
  
  // Create token with role
  const token = createToken({
    id: user.USER_ID,
    email: user.EMAIL,
    role: role,
  });
  
  res.json({
    success: true,                                 // ← NEW: Added success flag
    token: token,
    user: { 
      id: user.USER_ID, 
      email: user.EMAIL, 
      name: user.FULL_NAME,
      role: role,                                  // ← NEW: Added role to user object
      phone: user.PHONE,                           // ← NEW: Added phone
      status: user.STATUS,                         // ← NEW: Added status
      permissions: getPermissions(role),
    },
    redirectUrl: redirectUrl                       // ← NEW: Added redirect URL
  });
}

// ============================================
// UPDATED: Exports with new items
// ============================================
module.exports = { 
  login, 
  getRedirectUrl,
  getPermissions,
  ROLE_REDIRECT_MAP,
  ROLE_PERMISSIONS_MAP
};