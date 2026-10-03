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
    "Veterinarian": [
      "Dashboard.html",
      "emergency_management.html",
      "clinic_calendar.html",
      "records.html",
      "staff_service_settings.html",
      "appointment.html",
    ],
    "Accountant": [
      "billing.html",
      "report.html",
    ],
    "InventoryManager": [
      "inventory.html",
    ],
    "Receptionist": [
      "clinic_calendar.html",
      "appointment.html",
      "records.html",
      "message.html",
    ],
    "Technician": [
      "records.html",
      "inventory.html",
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

  function formatTimeAgo(dateInput) {
    if (!dateInput) return "Just now";
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return "Recently";
    const seconds = Math.floor((new Date() - date) / 1000);
    if (seconds < 60) return "Just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  function installNotificationBell(allowedPages = []) {
    // Collect all notification bell triggers across desktop header, mobile bar, etc.
    const icons = [...document.querySelectorAll(".material-symbols-outlined")].filter((icon) => {
      const text = icon.textContent.trim();
      if (text !== "notifications" && text !== "notifications_active") return false;
      // Exclude settings tabs, sidebars, form buttons, table items
      if (icon.closest("nav, aside, [data-tab], .tab-panel, #tab-notifications, .tab-button, form, table")) {
        return false;
      }
      return true;
    });

    const explicitBells = [
      ...document.querySelectorAll("#notificationBell, #notificationBellDesktop, [data-notification-bell], [data-notif-trigger]"),
    ];

    const triggers = new Set();
    icons.forEach((icon) => {
      const btn = icon.closest("button") || icon.closest(".cursor-pointer") || icon.parentElement || icon;
      triggers.add(btn);
    });
    explicitBells.forEach((bell) => triggers.add(bell));

    if (triggers.size === 0) return;

    // Create container panel
    const panel = document.createElement("section");
    panel.id = "portalNotificationPanel";
    panel.style.cssText = `
      position: fixed;
      display: none;
      flex-direction: column;
      width: min(420px, calc(100vw - 24px));
      max-height: 520px;
      background: #ffffff;
      border: 1px solid #d7dddd;
      border-radius: 16px;
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.22);
      z-index: 99999;
      color: #1b1c1c;
      overflow: hidden;
      font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
    `;

    panel.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:14px 18px;border-bottom:1px solid #eef2f2;background:#fbfdfd">
        <div style="display:flex;align-items:center;gap:8px">
          <span style="font-weight:700;font-size:15px;color:#0b3032">Notifications</span>
          <span data-unread-pill style="background:#ba1a1a;color:#fff;font-size:11px;font-weight:700;padding:2px 7px;border-radius:999px;display:none">0</span>
        </div>
        <div style="display:flex;align-items:center;gap:12px">
          <button type="button" data-read-all style="color:#036469;background:none;border:0;font-size:12px;font-weight:600;cursor:pointer;padding:4px 6px;border-radius:6px;transition:background 0.2s" onmouseover="this.style.background='#e5fdff'" onmouseout="this.style.background='none'">Mark all read</button>
          <button type="button" data-close-panel style="color:#6f797a;background:none;border:0;font-size:20px;font-weight:700;cursor:pointer;padding:2px 6px;line-height:1;border-radius:6px" title="Close">&times;</button>
        </div>
      </div>
      <div style="display:flex;gap:6px;padding:8px 16px;background:#f8fafa;border-bottom:1px solid #eef2f2;font-size:12px">
        <button type="button" data-filter="all" style="padding:4px 10px;border-radius:20px;border:0;background:#036469;color:#fff;font-weight:600;cursor:pointer">All</button>
        <button type="button" data-filter="unread" style="padding:4px 10px;border-radius:20px;border:0;background:transparent;color:#4a5556;font-weight:600;cursor:pointer">Unread</button>
        <button type="button" data-filter="emergency" style="padding:4px 10px;border-radius:20px;border:0;background:transparent;color:#4a5556;font-weight:600;cursor:pointer">🚨 Alerts</button>
        <button type="button" data-filter="appointment" style="padding:4px 10px;border-radius:20px;border:0;background:transparent;color:#4a5556;font-weight:600;cursor:pointer">📅 Bookings</button>
      </div>
      <div data-notification-list style="flex:1;overflow-y:auto;padding:8px;max-height:400px;display:flex;flex-direction:column;gap:6px">
        <p style="padding:24px;text-align:center;color:#6f797a;font-size:13px">Loading notifications...</p>
      </div>
    `;
    document.body.appendChild(panel);

    const badges = [];
    let currentNotifications = [];
    let currentFilter = "all";
    let activeTrigger = null;

    const positionPanel = (trigger) => {
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const panelWidth = Math.min(420, window.innerWidth - 24);
      let top = rect.bottom + 8;
      let right = window.innerWidth - rect.right;
      if (right < 8) right = 8;
      if (right + panelWidth > window.innerWidth) {
        right = 8;
      }
      panel.style.top = `${Math.round(top)}px`;
      panel.style.right = `${Math.round(right)}px`;
      panel.style.width = `${Math.round(panelWidth)}px`;
    };

    const isOpen = () => panel.style.display === "flex";

    const openPanel = (trigger) => {
      activeTrigger = trigger;
      positionPanel(trigger);
      panel.style.display = "flex";
      loadNotifications();
    };

    const closePanel = () => {
      panel.style.display = "none";
      activeTrigger = null;
    };

    const toggle = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const trigger = e.currentTarget;
      if (isOpen()) {
        closePanel();
      } else {
        openPanel(trigger);
      }
    };

    // Close on click outside
    document.addEventListener("click", (event) => {
      if (!isOpen()) return;
      if (panel.contains(event.target)) return;
      if (event.target.closest("[data-notif-trigger]")) return;
      closePanel();
    });

    // Close on Escape key
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && isOpen()) {
        closePanel();
      }
    });

    // Handle window resize
    window.addEventListener("resize", () => {
      if (isOpen() && activeTrigger) {
        positionPanel(activeTrigger);
      }
    });

    panel.querySelector("[data-close-panel]").addEventListener("click", (e) => {
      e.stopPropagation();
      closePanel();
    });

    // Setup filter buttons
    panel.querySelectorAll("[data-filter]").forEach((btn) => {
      btn.addEventListener("click", () => {
        panel.querySelectorAll("[data-filter]").forEach((b) => {
          b.style.background = "transparent";
          b.style.color = "#4a5556";
        });
        btn.style.background = "#036469";
        btn.style.color = "#fff";
        currentFilter = btn.dataset.filter;
        renderNotificationItems();
      });
    });

    // Attach to bells across page
    triggers.forEach((trigger) => {
      trigger.style.cursor = "pointer";
      trigger.setAttribute("aria-label", "Open notifications");
      trigger.dataset.notifTrigger = "true";

      // Clear any conflicting inline toast clicks
      if (trigger.getAttribute("onclick") && trigger.getAttribute("onclick").includes("showToast")) {
        trigger.removeAttribute("onclick");
      }

      trigger.addEventListener("click", toggle);

      if (trigger.querySelector("[data-notification-badge]")) return;
      trigger.style.position = "relative";

      // Hide any existing hardcoded static dot inside the bell button
      const staticDots = trigger.querySelectorAll(".bg-emergency-red");
      staticDots.forEach((dot) => {
        if (!dot.hasAttribute("data-notification-badge")) {
          dot.style.display = "none";
        }
      });

      const badge = document.createElement("span");
      badge.dataset.notificationBadge = "";
      badge.hidden = true;
      badge.style.cssText = `
        position: absolute;
        top: -3px;
        right: -3px;
        min-width: 17px;
        height: 17px;
        padding: 0 4px;
        border-radius: 999px;
        background: #ba1a1a;
        color: #ffffff;
        font: bold 10px/17px sans-serif;
        text-align: center;
        box-shadow: 0 2px 6px rgba(186, 26, 26, 0.4);
        pointer-events: none;
        z-index: 20;
        display: none;
      `;
      trigger.appendChild(badge);
      badges.push(badge);
    });

    function getCategoryConfig(type) {
      switch (type) {
        case "emergency":
          return { icon: "emergency", color: "#ba1a1a", bg: "#ffdad6", border: "#ffb4ab", label: "EMERGENCY" };
        case "appointment":
          return { icon: "calendar_month", color: "#036469", bg: "#e5fdff", border: "#b2ebf2", label: "BOOKING" };
        case "message":
          return { icon: "chat", color: "#6b4fa2", bg: "#f3e8ff", border: "#e9d5ff", label: "MESSAGE" };
        case "billing":
          return { icon: "receipt_long", color: "#1b6f38", bg: "#dcfce7", border: "#bbf7d0", label: "BILLING" };
        case "inventory":
          return { icon: "inventory_2", color: "#b45309", bg: "#fef3c7", border: "#fde68a", label: "INVENTORY" };
        case "reminder":
        default:
          return { icon: "notifications_active", color: "#c2410c", bg: "#ffedd5", border: "#fed7aa", label: "REMINDER" };
      }
    }

    function renderNotificationItems() {
      const list = panel.querySelector("[data-notification-list]");
      let filtered = currentNotifications;

      if (currentFilter === "unread") {
        filtered = filtered.filter((i) => i.is_read === "N");
      } else if (currentFilter === "emergency") {
        filtered = filtered.filter((i) => i.type === "emergency");
      } else if (currentFilter === "appointment") {
        filtered = filtered.filter((i) => i.type === "appointment");
      }

      if (!filtered.length) {
        list.innerHTML = '<p style="padding:28px 16px;text-align:center;color:#6f797a;font-size:13px">No notifications in this category.</p>';
        return;
      }

      list.innerHTML = filtered
        .map((item) => {
          const cfg = getCategoryConfig(item.type);
          const isUnread = item.is_read === "N";
          const timeAgo = formatTimeAgo(item.created_at);

          return `
            <div data-notification-id="${escapeHtml(item.id)}" data-notification-link="${escapeHtml(item.link || "")}"
                 style="display:flex;align-items:flex-start;gap:12px;padding:12px 14px;border-radius:12px;cursor:pointer;border:1px solid ${isUnread ? cfg.border : "#f0f4f4"};background:${isUnread ? (cfg.bg + "40") : "#ffffff"};transition:all 0.15s ease"
                 onmouseover="this.style.transform='translateY(-1px)';this.style.boxShadow='0 4px 12px rgba(0,0,0,0.06)'"
                 onmouseout="this.style.transform='none';this.style.boxShadow='none'">
              <div style="width:36px;height:36px;border-radius:10px;background:${cfg.bg};color:${cfg.color};display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:2px">
                <span class="material-symbols-outlined" style="font-size:20px">${cfg.icon}</span>
              </div>
              <div style="flex:1;min-width:0">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:2px">
                  <span style="font-size:10px;font-weight:700;letter-spacing:0.5px;color:${cfg.color};text-transform:uppercase">${cfg.label}</span>
                  <span style="font-size:11px;color:#8e9999">${timeAgo}</span>
                </div>
                <strong style="display:block;font-size:13px;font-weight:700;color:${isUnread ? "#0b3032" : "#3b4445"};margin-bottom:3px;line-height:1.3">${escapeHtml(item.title)}</strong>
                <p style="margin:0;font-size:12px;color:#5b6566;line-height:1.4">${escapeHtml(item.message)}</p>
              </div>
              ${isUnread ? `<span style="width:8px;height:8px;border-radius:50%;background:${cfg.color};flex-shrink:0;margin-top:8px"></span>` : ""}
            </div>
          `;
        })
        .join("");
    }

    async function loadNotifications() {
      try {
        const response = await window.portalApiFetch("/api/notifications");
        if (!response.ok) return;
        const payload = await response.json();
        currentNotifications = payload.data || [];
        const unreadCount = currentNotifications.filter((item) => item.is_read === "N").length;

        // Update badges
        badges.forEach((badge) => {
          badge.hidden = unreadCount === 0;
          badge.style.display = unreadCount > 0 ? "inline-block" : "none";
          badge.textContent = unreadCount > 9 ? "9+" : unreadCount;
        });

        // Update unread pill in dropdown header
        const unreadPill = panel.querySelector("[data-unread-pill]");
        if (unreadPill) {
          unreadPill.style.display = unreadCount > 0 ? "inline-block" : "none";
          unreadPill.textContent = unreadCount > 9 ? "9+" : unreadCount;
        }

        renderNotificationItems();
      } catch (error) {
        console.warn("Unable to load notifications:", error);
      }
    }

    // Handle clicks inside panel
    panel.addEventListener("click", async (event) => {
      const card = event.target.closest("[data-notification-id]");
      if (card) {
        const id = card.dataset.notificationId;
        const link = card.dataset.notificationLink;

        // Mark read
        try {
          await window.portalApiFetch(`/api/notifications/${id}/read`, { method: "PATCH" });
          const item = currentNotifications.find((i) => i.id === id);
          if (item) item.is_read = "Y";
          loadNotifications();
        } catch (e) {}

        // If notification has a link, verify permissions and navigate
        if (link) {
          const targetPage = link.split("?")[0].replace(/^\.\//, "").split("/").pop();
          const canAccess = allowedPages.some((p) => targetPage.toLowerCase().endsWith(p.toLowerCase()));
          if (canAccess) {
            closePanel();
            window.location.href = getPortalUrl(link);
          }
        }
        return;
      }

      if (event.target.matches("[data-read-all]") || event.target.closest("[data-read-all]")) {
        try {
          await window.portalApiFetch("/api/notifications/read-all", { method: "PATCH" });
          currentNotifications.forEach((item) => (item.is_read = "Y"));
          loadNotifications();
        } catch (e) {}
      }
    });

    // Initial load on page ready
    loadNotifications();

    // Auto refresh every 30 seconds
    setInterval(loadNotifications, 30000);
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
      // Page-specific searches manage their own data and results. Do not add
      // the generic table/search-page behavior on top of them.
      .filter((input) => !input.matches("[data-record-search]"))
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

    installNotificationBell(allowedPages);
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

  window.getCurrentUser = function getCurrentUser() {
    try {
      const userRaw = localStorage.getItem("user");
      if (!userRaw) return null;
      const userObj = JSON.parse(userRaw);
      if (userObj) {
        userObj.id = userObj.id || userObj.userId || userObj.user_id;
        userObj.userId = userObj.id;
        userObj.user_id = userObj.id;
      }
      return userObj;
    } catch (e) {
      return null;
    }
  };
})();

// Apply system preferences globally
window.applySystemPreferences = function applySystemPreferences() {
  try {
    const prefsJson = localStorage.getItem("systemPreferences");
    if (prefsJson) {
      const prefs = JSON.parse(prefsJson);
      
      // Apply primary color
      if (prefs.color) {
        document.documentElement.style.setProperty('--color-primary', prefs.color);
      }
    }
  } catch (e) {
    console.error("Error applying system preferences:", e);
  }
};
window.applySystemPreferences();
