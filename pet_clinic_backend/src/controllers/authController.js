const userModel = require("../models/userModel");
const crypto = require("crypto");
const { sendEmail } = require("../services/emailService");
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

function normalizeRole(role) {
  const suppliedRole = String(role || "").trim();
  const canonicalRole = Object.keys(ROLE_PERMISSIONS_MAP).find(
    (knownRole) => knownRole.toLowerCase() === suppliedRole.toLowerCase(),
  );

  return canonicalRole || "Veterinarian";
}

function getRedirectUrl(role) {
  return ROLE_REDIRECT_MAP[role] || "/admin_portal_vet_website/Dashboard.html";
}

function getPermissions(role) {
  return ROLE_PERMISSIONS_MAP[role] || ["Dashboard.html"];
}

async function getCurrentProfile(req, res, next) {
  try {
    const user = await userModel.findPublicById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User profile not found" });
    }

    const role = normalizeRole(user.ROLE);
    return res.json({
      success: true,
      user: {
        id: user.USER_ID,
        email: user.EMAIL,
        name: user.FULL_NAME,
        role,
        phone: user.PHONE,
        status: user.STATUS,
        profileImage: user.PROFILE_IMAGE || null,
        permissions: getPermissions(role),
      },
    });
  } catch (error) {
    next(error);
  }
}

async function login(req, res) {
  const { email, password } = req.body;
  
  // Get user with role from database
  const user = await userModel.findByEmail(email);
  
  // Accounts created through the app use bcrypt. Some legacy accounts were
  // entered directly into Oracle with a plain-text password; allow one
  // successful sign-in for those accounts and immediately convert it to a
  // bcrypt hash so future sign-ins remain secure.
  let passwordMatches = false;
  if (user && typeof password === "string") {
    const storedPassword = String(user.PASSWORD_HASH || "");
    if (/^\$2[aby]\$/.test(storedPassword)) {
      passwordMatches = await comparePassword(password, storedPassword);
    } else if (storedPassword === password) {
      passwordMatches = true;
      await userModel.updatePasswordHash(user.USER_ID, await hashPassword(password));
    }
  }

  if (!user || !passwordMatches) {
    return res.status(401).json({ 
      success: false,                              // ← NEW: Added success flag
      message: "Invalid email or password" 
    });
  }
  
  // ============================================
  // NEW: Check if user account is active
  // ============================================
  if (String(user.STATUS || "").trim().toLowerCase() !== "active") {
    return res.status(403).json({
      success: false,
      message: "Account is inactive. Please contact administrator."
    });
  }
  
  // ============================================
  // NEW: Get role from user object (from database)
  // ============================================
  const role = normalizeRole(user.ROLE);
  
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
      profileImage: user.PROFILE_IMAGE || null,
      permissions: getPermissions(role),
    },
    redirectUrl: redirectUrl                       // ← NEW: Added redirect URL
  });
}

function hashResetToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

async function requestPasswordReset(req, res, next) {
  const email = String(req.body.email || "").trim();
  const successMessage = "If that email belongs to an active account, a reset link has been sent.";

  try {
    const user = await userModel.findByEmail(email);
    if (!user || String(user.STATUS || "").trim().toLowerCase() !== "active") {
      return res.json({ success: true, message: successMessage });
    }

    const token = crypto.randomBytes(32).toString("hex");
    await userModel.savePasswordResetToken(user.EMAIL, hashResetToken(token));

    const appOrigin = process.env.PUBLIC_APP_URL || `${req.protocol}://${req.get("host")}`;
    const resetUrl = `${appOrigin}/reset_password.html?token=${encodeURIComponent(token)}`;
    await sendEmail({
      to: user.EMAIL,
      subject: "Reset your addyPets portal password",
      text: `A password reset was requested for your addyPets account. Set a new password within 30 minutes: ${resetUrl}`,
      html: `<p>A password reset was requested for your addyPets account.</p><p><a href="${resetUrl}">Set a new password</a></p><p>This link expires in 30 minutes. If you did not request it, you can ignore this email.</p>`,
    });

    return res.json({ success: true, message: successMessage });
  } catch (error) {
    next(error);
  }
}

async function resetPassword(req, res, next) {
  const { token, password } = req.body;
  if (typeof token !== "string" || typeof password !== "string" || password.length < 8) {
    return res.status(400).json({ success: false, message: "A valid reset link and a password of at least 8 characters are required." });
  }

  try {
    const result = await userModel.resetPassword(
      hashResetToken(token),
      await hashPassword(password),
    );
    if (!result.rowsAffected) {
      return res.status(400).json({ success: false, message: "This reset link is invalid or has expired. Request a new one." });
    }
    return res.json({ success: true, message: "Password updated. You can now sign in." });
  } catch (error) {
    next(error);
  }
}

async function updateProfileImage(req, res, next) {
  const profileImage = req.body?.profileImage;
  if (typeof profileImage !== "string" || !/^data:image\/(png|jpe?g|webp);base64,/.test(profileImage) || profileImage.length > 2_800_000) {
    return res.status(400).json({ success: false, message: "Use a PNG, JPEG, or WebP image smaller than 2 MB." });
  }
  try {
    await userModel.updateProfileImage(req.user.id, profileImage);
    res.json({ success: true, profileImage });
  } catch (error) { next(error); }
}

// ============================================
// UPDATED: Exports with new items
// ============================================
module.exports = { 
  login, 
  requestPasswordReset,
  resetPassword,
  updateProfileImage,
  getCurrentProfile,
  getRedirectUrl,
  getPermissions,
  ROLE_REDIRECT_MAP,
  ROLE_PERMISSIONS_MAP,
  normalizeRole
};
