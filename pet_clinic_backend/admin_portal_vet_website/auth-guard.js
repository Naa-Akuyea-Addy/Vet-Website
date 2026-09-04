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

  function normalizeRole(role) {
    const suppliedRole = String(role || "").trim();
    return (
      Object.keys(ROLE_PERMISSIONS_MAP).find(
        (knownRole) => knownRole.toLowerCase() === suppliedRole.toLowerCase(),
      ) || "Veterinarian"
    );
  }

  // -------------------------------------------------------
  // Detect whether the app is running through the Node.js
  // server (http/https) or opened directly as a file://
  // -------------------------------------------------------
  const isFileProtocol = window.location.protocol === "file:";
  const isLocalDevelopmentHost = ["localhost", "127.0.0.1"].includes(window.location.hostname);

  // API routes are served by Node on port 3000. Opening an admin HTML file
  // through Live Server/file:// makes relative /api requests return HTML,
  // which in turn caused the profile upload JSON parsing error.
  if (isFileProtocol || (isLocalDevelopmentHost && window.location.port !== "3000")) {
    const requestedPage = window.location.pathname.split("/").pop() || "Dashboard.html";
    window.location.replace(`http://localhost:3000/admin_portal_vet_website/${requestedPage}`);
    return;
  }

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

    const role = normalizeRole(user.role);
    user.role = role;
    localStorage.setItem("user", JSON.stringify(user));
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

  function escapeHtml(value) {
    const element = document.createElement("div");
    element.textContent = value || "";
    return element.innerHTML;
  }

  function installNotificationBell() {
    const icons = [...document.querySelectorAll(".material-symbols-outlined")]
      .filter((icon) => icon.textContent.trim() === "notifications");
    if (!icons.length) return;

    const panel = document.createElement("section");
    panel.id = "portalNotificationPanel";
    panel.hidden = true;
    panel.style.cssText = "position:fixed;right:16px;top:76px;width:min(360px,calc(100vw - 32px));max-height:420px;overflow:auto;background:#fff;border:1px solid #d7dddd;border-radius:12px;box-shadow:0 16px 40px #0003;z-index:1000;padding:12px;color:#1b1c1c";
    panel.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center"><strong>Notifications</strong><button type="button" data-read-all style="color:#036469;background:none;border:0;cursor:pointer">Mark all read</button></div><div data-notification-list style="padding-top:8px"></div>';
    document.body.appendChild(panel);

    const badges = [];
    const toggle = () => {
      panel.hidden = !panel.hidden;
      if (!panel.hidden) loadNotifications();
    };
    icons.forEach((icon) => {
      const trigger = icon.closest("button") || icon;
      trigger.style.cursor = "pointer";
      trigger.setAttribute("aria-label", "Open notifications");
      trigger.addEventListener("click", toggle);
      const host = trigger.parentElement;
      if (!host || host.querySelector("[data-notification-badge]")) return;
      host.style.position = "relative";
      const badge = document.createElement("span");
      badge.dataset.notificationBadge = "";
      badge.hidden = true;
      badge.style.cssText = "position:absolute;right:0;top:0;min-width:16px;height:16px;padding:0 4px;border-radius:999px;background:#ba1a1a;color:#fff;font:10px/16px sans-serif;text-align:center";
      host.appendChild(badge);
      badges.push(badge);
    });

    async function loadNotifications() {
      const list = panel.querySelector("[data-notification-list]");
      try {
        const response = await window.portalApiFetch("/api/notifications");
        const payload = await response.json();
        const items = payload.data || [];
        const unread = items.filter((item) => item.IS_READ === "N").length;
        badges.forEach((badge) => { badge.hidden = unread === 0; badge.textContent = unread > 9 ? "9+" : unread; });
        list.innerHTML = items.length ? items.map((item) => `<button data-notification-id="${item.NOTIFICATION_ID}" style="display:block;width:100%;text-align:left;border:0;background:${item.IS_READ === "N" ? "#e5fdff" : "transparent"};padding:10px;border-radius:8px;cursor:pointer"><strong>${escapeHtml(item.TITLE)}</strong><br><span style="font-size:12px">${escapeHtml(item.MESSAGE)}</span></button>`).join("") : '<p style="padding:16px;text-align:center;color:#6f797a">No notifications</p>';
      } catch (error) {
        list.textContent = "Unable to load notifications.";
      }
    }

    panel.addEventListener("click", async (event) => {
      const item = event.target.closest("[data-notification-id]");
      if (item) await window.portalApiFetch(`/api/notifications/${item.dataset.notificationId}/read`, { method: "PATCH" });
      if (event.target.matches("[data-read-all]")) await window.portalApiFetch("/api/notifications/read-all", { method: "PATCH" });
      if (item || event.target.matches("[data-read-all]")) loadNotifications();
    });
  }

  function installProfilePhotoEditor(user) {
    const avatars = [...document.querySelectorAll('img[alt="Profile"], img[data-user-avatar]')];
    if (!avatars.length) return;
    const editor = document.createElement("div");
    editor.hidden = true;
    editor.style.cssText = "position:fixed;inset:0;background:#0008;z-index:1100;place-items:center;padding:16px";
    editor.innerHTML = '<form style="background:#fff;border-radius:12px;padding:24px;width:min(400px,100%);color:#1b1c1c"><h2 style="margin-top:0">Update profile photo</h2><p style="font-size:14px">PNG, JPEG, or WebP up to 2 MB.</p><input type="file" accept="image/png,image/jpeg,image/webp" required><p data-photo-status role="status" style="min-height:20px;color:#ba1a1a;font-size:13px"></p><div style="margin-top:20px;display:flex;justify-content:end;gap:8px"><button type="button" data-cancel style="padding:9px 14px">Cancel</button><button data-save style="background:#036469;color:#fff;border:0;border-radius:6px;padding:9px 14px" type="submit">Save photo</button></div></form>';
    document.body.appendChild(editor);
    const open = () => { editor.hidden = false; editor.style.display = "grid"; };
    avatars.forEach((avatar) => {
      avatar.style.cursor = "pointer";
      avatar.title = "Change profile photo";
      avatar.addEventListener("click", open);
      if (user.profileImage) avatar.src = user.profileImage;
    });
    const closeEditor = () => { editor.hidden = true; editor.style.display = "none"; editor.querySelector("form").reset(); editor.querySelector("[data-photo-status]").textContent = ""; };
    editor.querySelector("[data-cancel]").onclick = closeEditor;
    editor.addEventListener("click", (event) => { if (event.target === editor) closeEditor(); });
    editor.querySelector("form").addEventListener("submit", async (event) => {
      event.preventDefault();
      const file = editor.querySelector("input").files[0];
      const status = editor.querySelector("[data-photo-status]");
      const saveButton = editor.querySelector("[data-save]");
      if (!file || file.size > 2 * 1024 * 1024) { status.textContent = "Choose an image smaller than 2 MB."; return; }
      saveButton.disabled = true;
      saveButton.textContent = "Saving…";
      try {
        const profileImage = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file); });
        const response = await window.portalApiFetch("/api/auth/profile-image", { method: "PATCH", body: JSON.stringify({ profileImage }) });
        const isJson = (response.headers.get("content-type") || "").includes("application/json");
        const payload = isJson ? await response.json() : { message: "The profile API returned a web page. Restart the backend and open the portal at http://localhost:3000." };
        if (!response.ok) throw new Error(payload.message || "Unable to update your photo.");
        user.profileImage = payload.profileImage;
        localStorage.setItem("user", JSON.stringify(user));
        avatars.forEach((avatar) => { avatar.src = payload.profileImage; });
        closeEditor();
      } catch (error) {
        status.textContent = error.message || "Unable to update your photo.";
      } finally {
        saveButton.disabled = false;
        saveButton.textContent = "Save photo";
      }
    });
  }

  function renderCurrentProfile(user) {
    document.querySelectorAll("header p.font-label-md, .user-profile-name, [data-user-name]").forEach((element) => {
      if (user.name) element.textContent = user.name;
    });
    document.querySelectorAll("header p.font-caption, .user-profile-role, [data-user-role]").forEach((element) => {
      element.textContent = user.role;
    });

    // Admin pages use a few different Tailwind class combinations for the
    // name and role. In every layout, however, those two paragraphs share a
    // container with the profile avatar. Update that pair as the reliable
    // fallback for pages that do not expose the data-user-* attributes.
    document.querySelectorAll('img[alt="Profile"], img[data-user-avatar]').forEach((avatar) => {
      const profileContainer = avatar.parentElement;
      const textContainer = [...(profileContainer?.children || [])].find(
        (child) => child !== avatar && child.querySelector && child.querySelector("p"),
      );
      const lines = textContainer ? [...textContainer.querySelectorAll("p")] : [];
      if (lines.length) {
        if (user.name) lines[0].textContent = user.name;
        if (user.role && lines.length > 1) lines[lines.length - 1].textContent = user.role;
      }
      if (user.profileImage) avatar.src = user.profileImage;
    });
  }

  async function refreshCurrentProfile(user) {
    try {
      const response = await window.portalApiFetch("/api/auth/profile");
      if (!response.ok) return;
      const payload = await response.json();
      if (!payload || !payload.user) return;

      Object.assign(user, payload.user);
      localStorage.setItem("user", JSON.stringify(user));
      renderCurrentProfile(user);
    } catch (error) {
      console.warn("Unable to refresh the current user profile:", error);
    }
  }

  function installLogoutDialog() {
    const dialog = document.createElement("div");
    dialog.hidden = true;
    dialog.style.cssText = "position:fixed;inset:0;background:#0008;z-index:1100;place-items:center;padding:16px";
    dialog.innerHTML = '<section role="dialog" aria-modal="true" aria-labelledby="logoutDialogTitle" style="background:#fff;border-radius:12px;padding:24px;width:min(390px,100%);color:#1b1c1c"><h2 id="logoutDialogTitle" style="margin-top:0">Log out?</h2><p>You will need to sign in again to access the portal.</p><div style="display:flex;justify-content:end;gap:8px;margin-top:24px"><button type="button" data-logout-cancel style="padding:9px 14px">Cancel</button><button type="button" data-logout-confirm style="background:#ba1a1a;color:#fff;border:0;border-radius:6px;padding:9px 14px">Log out</button></div></section>';
    document.body.appendChild(dialog);
    const close = () => { dialog.hidden = true; dialog.style.display = "none"; };
    const open = () => { dialog.hidden = false; dialog.style.display = "grid"; dialog.querySelector("[data-logout-cancel]").focus(); };
    dialog.querySelector("[data-logout-cancel]").onclick = close;
    dialog.addEventListener("click", (event) => { if (event.target === dialog) close(); });
    dialog.querySelector("[data-logout-confirm]").onclick = () => {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.href = getLoginUrl();
    };
    document.addEventListener("click", (event) => {
      if (!event.target.closest("#logoutBtnDesktop, #logoutBtnMobile, [data-logout]")) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      open();
    }, true);
    window.logout = (event) => { if (event) event.preventDefault(); open(); };
  }

  function installPageSearch(allowedPages) {
    const searchInputs = [...document.querySelectorAll("header input[type='text']")]
      .filter((input) => /search/i.test(input.placeholder || ""));

    searchInputs.forEach((input) => {
      const host = input.parentElement;
      if (!host || host.querySelector("[data-search-status]")) return;
      host.style.position = "relative";
      const status = document.createElement("div");
      status.dataset.searchStatus = "";
      status.hidden = true;
      status.style.cssText = "position:absolute;left:0;right:0;top:calc(100% + 6px);max-height:260px;overflow:auto;background:#fff;border:1px solid #bec8c9;border-radius:8px;padding:8px;box-shadow:0 8px 24px #0002;z-index:10000;pointer-events:auto;font-size:12px;color:#3f4949";
      host.appendChild(status);

      const runSearch = () => {
        const query = input.value.trim().toLowerCase();
        const rows = [...document.querySelectorAll("tbody tr")];
        const matchingRows = [];
        rows.forEach((row, index) => {
          const matchesQuery = !query || row.textContent.toLowerCase().includes(query);
          row.hidden = !matchesQuery;
          if (matchesQuery) matchingRows.push({ row, index });
        });
        status.hidden = !query;
        if (!query) return;
        if (!rows.length) {
          const matchingPages = allowedPages.filter((page) => page.toLowerCase().includes(query));
          status.innerHTML = matchingPages.length
            ? matchingPages.map((page) => `<button type="button" data-search-page="${page}" style="display:block;width:100%;padding:8px;text-align:left;border:0;background:transparent;cursor:pointer">Open ${escapeHtml(page.replace(".html", ""))}</button>`).join("")
            : "No matching records on this page.";
          return;
        }
        status.innerHTML = matchingRows.length
          ? matchingRows.slice(0, 6).map(({ row, index }) => `<button type="button" data-search-row="${index}" style="display:block;width:100%;padding:8px;text-align:left;border:0;background:transparent;cursor:pointer;border-radius:6px">${escapeHtml(row.textContent.trim().replace(/\s+/g, " ").slice(0, 110))}</button>`).join("") + `<p style="margin:6px 8px 0">${matchingRows.length} matching record${matchingRows.length === 1 ? "" : "s"}. Press Esc to clear.</p>`
          : "No matching records.";
      };

      input.addEventListener("input", runSearch);
      input.addEventListener("keydown", (event) => {
        if (event.key !== "Escape") return;
        input.value = "";
        runSearch();
        input.blur();
      });
      status.addEventListener("click", (event) => {
        const rowButton = event.target.closest("[data-search-row]");
        const pageButton = event.target.closest("[data-search-page]");
        if (rowButton) {
          const row = document.querySelectorAll("tbody tr")[Number(rowButton.dataset.searchRow)];
          if (row) { row.scrollIntoView({ behavior: "smooth", block: "center" }); row.style.outline = "2px solid #036469"; setTimeout(() => { row.style.outline = ""; }, 1500); }
        }
        if (pageButton) window.location.href = getPortalUrl(pageButton.dataset.searchPage);
      });
      status.addEventListener("mousedown", (event) => event.preventDefault());
    });
  }

  // DOM Enhancements (run after DOM is ready)
  document.addEventListener("DOMContentLoaded", function () {
    if (!auth) return;
    const { user, role, allowedPages } = auth;

    installNotificationBell();
    installProfilePhotoEditor(user);
    installLogoutDialog();
    installPageSearch(allowedPages);
    refreshCurrentProfile(user);

    // 1. Update Header Profile Info — covers all admin page header layouts.
    renderCurrentProfile({ ...user, role });

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
  });

  // -------------------------------------------------------
  // Global authenticated fetch helper
  // Usage: const data = await apiFetch('/api/appointments');
  // -------------------------------------------------------
  window.portalApiFetch = async function portalApiFetch(url, options = {}) {
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

  // Provide a compatibility helper named apiFetch for pages that call it.
  // apiFetch will prefer portalApiFetch (so it includes Authorization when available)
  // and will return the raw Response object (same shape as fetch). Callers that
  // want parsed JSON can use the helper apiFetchJson below which safely handles
  // both Response objects and already-parsed JSON values.
  window.apiFetch = window.apiFetch || (async function apiFetch(endpoint, options = {}) {
    try {
      const fetcher = typeof window.portalApiFetch === "function" ? window.portalApiFetch : fetch;
      const res = await fetcher(endpoint, options);
      return res;
    } catch (err) {
      // Re-throw so callers can handle network errors as before
      throw err;
    }
  });

  // Convenience helper that returns parsed JSON regardless of whether the
  // underlying apiFetch returned a Response or a parsed object.
  window.apiFetchJson = window.apiFetchJson || (async function apiFetchJson(endpoint, options = {}) {
    const resOrJson = await window.apiFetch(endpoint, options);
    try {
      if (resOrJson && typeof resOrJson.json === "function") {
        return await resOrJson.json();
      }
    } catch (e) {
      // fall through to return whatever we have
    }
    return resOrJson;
  });
})();
