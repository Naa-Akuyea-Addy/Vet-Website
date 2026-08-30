// =========================================================
// addyPets Veterinary Clinic - Admin Portal Auth Guard
// Role-Based Access Control & Navigation Security
// =========================================================

(function () {
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

  const ROLE_REDIRECT_MAP = {
    "Super Admin": "Dashboard.html",
    "Admin": "Dashboard.html",
    "Veterinarian": "emergency_management.html",
    "Accountant": "billing.html",
    "InventoryManager": "inventory.html",
    "Receptionist": "clinic_calendar.html",
    "Technician": "records.html",
  };

  // -------------------------------------------------------
  // Detect whether the app is running through the Node.js
  // server (http/https) or opened directly as a file://
  // -------------------------------------------------------
  const isFileProtocol = window.location.protocol === "file:";

  function getLoginUrl() {
    if (isFileProtocol) {
      // Opened as file:// — try to navigate relative to current file
      return "../public/vet_portal_login.html";
    }
    // Running through the Express server
    return "/vet_portal_login.html";
  }

  function getPortalUrl(page) {
    if (isFileProtocol) {
      return "./" + page;
    }
    return "/admin_portal_vet_website/" + page;
  }

  function getCurrentPageName() {
    const pathname = window.location.pathname;
    const segments = pathname.split("/");
    const lastSegment = segments[segments.length - 1] || "Dashboard.html";
    return lastSegment === "" ? "Dashboard.html" : lastSegment;
  }

  function checkAuthorization() {
    const token = localStorage.getItem("token");
    const userRaw = localStorage.getItem("user");

    // 1. Check if logged in
    if (!token || !userRaw) {
      window.location.href = getLoginUrl();
      return false;
    }

    let user;
    try {
      user = JSON.parse(userRaw);
    } catch (e) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.href = getLoginUrl();
      return false;
    }

    const role = user.role || "Veterinarian";
    const allowedPages = ROLE_PERMISSIONS_MAP[role] || ["Dashboard.html"];
    const currentPage = getCurrentPageName();

    // 2. Check if user is authorized for the current page
    const isAllowed = allowedPages.some((page) =>
      currentPage.toLowerCase().endsWith(page.toLowerCase())
    );

    if (!isAllowed) {
      const defaultPage = ROLE_REDIRECT_MAP[role] || "Dashboard.html";
      alert(
        `⛔ Access Denied!\n\nYour assigned role (${role}) does not have permission to access "${currentPage}".\nRedirecting to your portal...`
      );
      window.location.href = getPortalUrl(defaultPage);
      return false;
    }

    return { user, role, allowedPages };
  }

  // Run immediate auth check
  const auth = checkAuthorization();

  // DOM Enhancements (run after DOM is ready)
  document.addEventListener("DOMContentLoaded", function () {
    if (!auth) return;
    const { user, role, allowedPages } = auth;

    // 1. Update Header Profile Info — covers most page header layouts
    const profileNameEls = document.querySelectorAll(
      "header p.font-label-md, .user-profile-name, [data-user-name]"
    );
    profileNameEls.forEach((el) => {
      if (user.name) el.textContent = user.name;
    });

    const profileRoleEls = document.querySelectorAll(
      "header p.font-caption, .user-profile-role, [data-user-role]"
    );
    profileRoleEls.forEach((el) => {
      el.textContent = role;
    });

    // 2. Filter Sidebar Links to match role privileges
    const navLinks = document.querySelectorAll("nav a[href], aside a[href]");
    navLinks.forEach((link) => {
      const href = link.getAttribute("href") || "";
      // Normalize: strip ./ prefix and portal path prefix
      const pageName = href
        .replace(/^\.\//, "")
        .replace(/^\/admin_portal_vet_website\//, "")
        .split("?")[0];

      if (pageName.endsWith(".html")) {
        const canAccess = allowedPages.some((p) =>
          pageName.toLowerCase() === p.toLowerCase()
        );

        if (!canAccess) {
          // Hide the parent <li> if present, otherwise hide the <a> itself
          const parentLi = link.closest("li");
          if (parentLi) {
            parentLi.style.display = "none";
          } else {
            link.style.display = "none";
          }
        }
      }
    });

    // 3. Attach logout handlers for any button with id logoutBtnDesktop/Mobile
    function handleLogout(e) {
      if (e) e.preventDefault();
      if (confirm("Are you sure you want to log out of addyPets Portal?")) {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        window.location.href = getLoginUrl();
      }
    }

    const logoutDesktop = document.getElementById("logoutBtnDesktop");
    const logoutMobile = document.getElementById("logoutBtnMobile");
    if (logoutDesktop) logoutDesktop.onclick = handleLogout;
    if (logoutMobile) logoutMobile.onclick = handleLogout;

    // Also wire up any element with data-logout attribute
    document.querySelectorAll("[data-logout]").forEach((btn) => {
      btn.onclick = handleLogout;
    });

    // Expose global logout for inline onclick handlers
    window.logout = handleLogout;
  });

  // -------------------------------------------------------
  // Global authenticated fetch helper
  // Usage: const data = await apiFetch('/api/appointments');
  // -------------------------------------------------------
  window.apiFetch = async function apiFetch(url, options = {}) {
    const token = localStorage.getItem("token");
    const headers = {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    };
    if (token) {
      headers["Authorization"] = "Bearer " + token;
    }
    const response = await fetch(url, { ...options, headers });
    if (response.status === 401) {
      // Token expired or invalid — log out
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.href = getLoginUrl();
      throw new Error("Session expired. Please log in again.");
    }
    return response;
  };
})();
