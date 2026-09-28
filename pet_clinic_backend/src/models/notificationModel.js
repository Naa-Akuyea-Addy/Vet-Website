const oracledb = require("oracledb");
try {
  oracledb.fetchAsString = [oracledb.CLOB];
} catch (e) {}
const { withConnection } = require("../config/database");

// Helper to format timestamps or relative time strings
function formatDateString(val) {
  if (!val) return new Date().toISOString();
  if (val instanceof Date) return val.toISOString();
  return String(val);
}

async function listForUser(userId, userRole) {
  return withConnection(async (connection) => {
    // 1. Resolve role if not provided
    let role = userRole;
    if (!role) {
      try {
        const userRes = await connection.execute(
          "SELECT ROLE FROM USERS WHERE USER_ID = :userId",
          { userId },
          { outFormat: oracledb.OUT_FORMAT_OBJECT },
        );
        role = userRes.rows?.[0]?.ROLE || "Veterinarian";
      } catch (e) {
        role = "Veterinarian";
      }
    }

    // 2. Fetch already marked read source_ids for this user
    const readSourceIds = new Set();
    try {
      const readRes = await connection.execute(
        "SELECT SOURCE_ID FROM USER_NOTIFICATIONS WHERE USER_ID = :userId AND IS_READ = 'Y' AND SOURCE_ID IS NOT NULL",
        { userId },
        { outFormat: oracledb.OUT_FORMAT_OBJECT },
      );
      (readRes.rows || []).forEach((r) => {
        if (r.SOURCE_ID) readSourceIds.add(String(r.SOURCE_ID));
      });
    } catch (e) {
      // ignore if table/col not yet created
    }

    const notifications = [];

    // 3. User-specific notifications from USER_NOTIFICATIONS
    try {
      const userNotifs = await connection.execute(
        `SELECT NOTIFICATION_ID, TITLE, MESSAGE, TYPE, LINK, SOURCE_ID, IS_READ, CREATED_AT
         FROM USER_NOTIFICATIONS
         WHERE USER_ID = :userId AND (SOURCE_ID IS NULL OR SOURCE_ID NOT LIKE 'sys-%')
         ORDER BY CREATED_AT DESC FETCH FIRST 15 ROWS ONLY`,
        { userId },
        { outFormat: oracledb.OUT_FORMAT_OBJECT },
      );
      (userNotifs.rows || []).forEach((row) => {
        notifications.push({
          id: `usr-${row.NOTIFICATION_ID}`,
          dbId: row.NOTIFICATION_ID,
          title: row.TITLE,
          message: row.MESSAGE,
          type: (row.TYPE || "info").toLowerCase(),
          link: row.LINK || "",
          is_read: row.IS_READ === "Y" ? "Y" : "N",
          created_at: formatDateString(row.CREATED_AT),
        });
      });
    } catch (e) {
      console.warn("User notifications query warning:", e.message);
    }

    // Role-based privilege flags
    const isSuperAdmin = /super\s*admin/i.test(role);
    const isAdmin = isSuperAdmin || /admin/i.test(role);
    const isVet = isSuperAdmin || /vet/i.test(role);
    const isReceptionist = isSuperAdmin || /reception/i.test(role);
    const isAccountant = isSuperAdmin || /account/i.test(role);
    const isInventory = isSuperAdmin || /inventory/i.test(role);
    const isTechnician = isSuperAdmin || /tech/i.test(role);

    // 4. Emergency Cases (for Vet, Super Admin, Admin, Receptionist)
    if (isVet || isAdmin || isReceptionist) {
      try {
        const emgRes = await connection.execute(
          `SELECT e.EMERGENCY_ID, p.PET_NAME AS PATIENT_NAME, p.OWNER_NAME,
                  e.DESCRIPTION, e.PRIORITY, e.STATUS, e.CREATED_AT
           FROM EMERGENCY_CASES e
           JOIN PATIENTS p ON p.PATIENT_ID = e.PATIENT_ID
           WHERE e.STATUS = 'OPEN'
           ORDER BY e.EMERGENCY_ID DESC FETCH FIRST 6 ROWS ONLY`,
          [],
          { outFormat: oracledb.OUT_FORMAT_OBJECT },
        );
        (emgRes.rows || []).forEach((row) => {
          const sourceId = `emg-${row.EMERGENCY_ID}`;
          const isRead = readSourceIds.has(sourceId) ? "Y" : "N";
          const desc = String(row.DESCRIPTION || "").slice(0, 90);
          notifications.push({
            id: sourceId,
            title: `🚨 Emergency: ${row.PATIENT_NAME || "Patient"} (${row.PRIORITY || "Urgent"})`,
            message: desc ? `${desc} - Owner: ${row.OWNER_NAME || "Walk-in"}` : `Active open emergency case requiring immediate care.`,
            type: "emergency",
            link: "emergency_management.html",
            is_read: isRead,
            created_at: formatDateString(row.CREATED_AT),
          });
        });
      } catch (e) {
        console.warn("Emergency query warning:", e.message);
      }
    }

    // 5. Appointments & Bookings
    // (Veterinarian: assigned or unassigned appointments; Receptionist/Admin: all pending/recent)
    if (isVet || isReceptionist || isAdmin) {
      try {
        let aptQuery = "";
        let aptBinds = {};
        if (isVet && !isAdmin && !isReceptionist) {
          aptQuery = `SELECT APPOINTMENT_ID, APPOINTMENT_NUMBER, PET_NAME, PET_SPECIES, OWNER_NAME, SERVICE, VISIT_REASON, APPOINTMENT_TIME, STATUS, CREATED_AT
                      FROM APPOINTMENTS
                      WHERE (VETERINARIAN_ID = :userId OR VETERINARIAN_ID IS NULL)
                        AND STATUS IN ('Pending', 'Confirmed')
                      ORDER BY APPOINTMENT_ID DESC FETCH FIRST 8 ROWS ONLY`;
          aptBinds = { userId };
        } else {
          aptQuery = `SELECT APPOINTMENT_ID, APPOINTMENT_NUMBER, PET_NAME, PET_SPECIES, OWNER_NAME, SERVICE, VISIT_REASON, APPOINTMENT_TIME, STATUS, CREATED_AT
                      FROM APPOINTMENTS
                      WHERE STATUS IN ('Pending', 'Confirmed')
                      ORDER BY APPOINTMENT_ID DESC FETCH FIRST 8 ROWS ONLY`;
          aptBinds = [];
        }

        const aptRes = await connection.execute(aptQuery, aptBinds, {
          outFormat: oracledb.OUT_FORMAT_OBJECT,
        });

        (aptRes.rows || []).forEach((row) => {
          const sourceId = `apt-${row.APPOINTMENT_ID}`;
          const isRead = readSourceIds.has(sourceId) ? "Y" : "N";
          const isPending = (row.STATUS || "").toLowerCase() === "pending";
          notifications.push({
            id: sourceId,
            title: isPending
              ? `📅 New Booking: ${row.PET_NAME || "Pet"} (${row.SERVICE || row.VISIT_REASON || "Checkup"})`
              : `🩺 Appointment: ${row.PET_NAME || "Pet"} @ ${row.APPOINTMENT_TIME || "Today"}`,
            message: `Owner: ${row.OWNER_NAME || "Client"} | Status: ${row.STATUS} | Time: ${row.APPOINTMENT_TIME || "Scheduled"}`,
            type: "appointment",
            link: isVet ? "clinic_calendar.html" : "appointment.html",
            is_read: isRead,
            created_at: formatDateString(row.CREATED_AT),
          });
        });
      } catch (e) {
        console.warn("Appointment query warning:", e.message);
      }
    }

    // 5b. New Patient Records — notify Doctors/Veterinarians only
    if (isVet && !isAdmin) {
      try {
        const newPatientsRes = await connection.execute(
          `SELECT PATIENT_ID, PATIENT_NUMBER, PET_NAME, PET_SPECIES, PET_BREED, OWNER_NAME, CREATED_AT
           FROM PATIENTS
           ORDER BY PATIENT_ID DESC FETCH FIRST 5 ROWS ONLY`,
          [],
          { outFormat: oracledb.OUT_FORMAT_OBJECT },
        );
        (newPatientsRes.rows || []).forEach((row) => {
          const sourceId = `newpat-${row.PATIENT_ID}`;
          const isRead = readSourceIds.has(sourceId) ? "Y" : "N";
          notifications.push({
            id: sourceId,
            title: `🐾 New Patient Record: ${row.PET_NAME || "Pet"} (${row.PET_SPECIES || "Animal"})`,
            message: `Owner: ${row.OWNER_NAME || "Unknown"} | Breed: ${row.PET_BREED || "N/A"} | Added to records`,
            type: "appointment",
            link: "records.html",
            is_read: isRead,
            created_at: formatDateString(row.CREATED_AT),
          });
        });
      } catch (e) {
        console.warn("New patient records notification warning:", e.message);
      }
    }


    // 6. Messages / Contact Form Submissions (for Super Admin, Admin, Receptionist)
    if (isAdmin || isReceptionist) {
      try {
        const msgRes = await connection.execute(
          `SELECT ID, NAME, EMAIL, PET_BREED, CUSTOMER_QUESTIONS, CREATED_AT
           FROM CONTACT_FORM
           ORDER BY ID DESC FETCH FIRST 5 ROWS ONLY`,
          [],
          { outFormat: oracledb.OUT_FORMAT_OBJECT },
        );
        (msgRes.rows || []).forEach((row) => {
          const sourceId = `msg-${row.ID}`;
          const isRead = readSourceIds.has(sourceId) ? "Y" : "N";
          const snippet = String(row.CUSTOMER_QUESTIONS || "").slice(0, 85);
          notifications.push({
            id: sourceId,
            title: `💬 Inbound Message from ${row.NAME || "Client"}`,
            message: snippet ? `"${snippet}" (${row.EMAIL || "No email"})` : `New website contact inquiry received.`,
            type: "message",
            link: "message.html",
            is_read: isRead,
            created_at: formatDateString(row.CREATED_AT),
          });
        });
      } catch (e) {
        console.warn("Contact form query warning:", e.message);
      }
    }

    // 7. Inventory Low Stock Alerts (for Super Admin, InventoryManager)
    if (isAdmin || isInventory) {
      try {
        const invRes = await connection.execute(
          `SELECT INVENTORY_ID, ITEM_NAME, CATEGORY, QUANTITY, REORDER_LEVEL
           FROM INVENTORY
           WHERE QUANTITY <= REORDER_LEVEL
           ORDER BY INVENTORY_ID DESC FETCH FIRST 5 ROWS ONLY`,
          [],
          { outFormat: oracledb.OUT_FORMAT_OBJECT },
        );
        (invRes.rows || []).forEach((row) => {
          const sourceId = `inv-${row.INVENTORY_ID}`;
          const isRead = readSourceIds.has(sourceId) ? "Y" : "N";
          notifications.push({
            id: sourceId,
            title: `📦 Low Stock Alert: ${row.ITEM_NAME}`,
            message: `Only ${row.QUANTITY} left in stock (Reorder threshold: ${row.REORDER_LEVEL}).`,
            type: "inventory",
            link: "inventory.html",
            is_read: isRead,
            created_at: new Date().toISOString(),
          });
        });
      } catch (e) {
        console.warn("Inventory query warning:", e.message);
      }
    }

    // 8. Billing & Unpaid Invoices (for Super Admin, Accountant)
    if (isAdmin || isAccountant) {
      try {
        const billRes = await connection.execute(
          `SELECT BILLING_ID, AMOUNT, DESCRIPTION, STATUS, ISSUED_AT
           FROM BILLING
           WHERE STATUS = 'Unpaid'
           ORDER BY BILLING_ID DESC FETCH FIRST 5 ROWS ONLY`,
          [],
          { outFormat: oracledb.OUT_FORMAT_OBJECT },
        );
        (billRes.rows || []).forEach((row) => {
          const sourceId = `bill-${row.BILLING_ID}`;
          const isRead = readSourceIds.has(sourceId) ? "Y" : "N";
          notifications.push({
            id: sourceId,
            title: `💰 Unpaid Invoice: GHS ${row.AMOUNT}`,
            message: `${row.DESCRIPTION || "Treatment / Service fee"} is currently pending payment.`,
            type: "billing",
            link: "billing.html",
            is_read: isRead,
            created_at: formatDateString(row.ISSUED_AT),
          });
        });
      } catch (e) {
        console.warn("Billing query warning:", e.message);
      }
    }

    // 9. Colleague Messages from STAFF_MESSAGES (for all logged in staff)
    if (userId) {
      try {
        const staffMsgRes = await connection.execute(
          `SELECT m.MESSAGE_ID, m.SENDER_ID, m.RECEIVER_ID, m.MESSAGE_TEXT, m.ATTACHMENT_NAME, m.CREATED_AT, m.IS_READ,
                  s.FULL_NAME AS SENDER_NAME, s.ROLE AS SENDER_ROLE
           FROM STAFF_MESSAGES m
           JOIN USERS s ON s.USER_ID = m.SENDER_ID
           WHERE (m.RECEIVER_ID = :userId OR (m.RECEIVER_ID IS NULL AND m.SENDER_ID != :userId))
             AND m.IS_READ = 0
           ORDER BY m.MESSAGE_ID DESC FETCH FIRST 10 ROWS ONLY`,
          { userId: Number(userId) },
          {
            outFormat: oracledb.OUT_FORMAT_OBJECT,
            fetchInfo: { MESSAGE_TEXT: { type: oracledb.STRING } },
          },
        );
        (staffMsgRes.rows || []).forEach((row) => {
          const sourceId = `staff-msg-${row.MESSAGE_ID}`;
          const isRead = readSourceIds.has(sourceId) ? "Y" : "N";
          const snippet = row.MESSAGE_TEXT
            ? (row.MESSAGE_TEXT.length > 90 ? row.MESSAGE_TEXT.slice(0, 90) + "..." : row.MESSAGE_TEXT)
            : (row.ATTACHMENT_NAME ? `📎 Attachment: ${row.ATTACHMENT_NAME}` : "Sent you a message.");
          notifications.push({
            id: sourceId,
            title: `💬 ${row.SENDER_NAME || "Colleague"} (${row.SENDER_ROLE || "Staff"})`,
            message: snippet,
            type: "message",
            link: `staff_service_settings.html?chatUserId=${row.SENDER_ID}`,
            is_read: isRead,
            created_at: formatDateString(row.CREATED_AT),
          });
        });
      } catch (e) {
        console.warn("Staff messages notification warning:", e.message);
      }
    }

    // 9. Contextual Operational Reminders tailored to each role
    const reminders = [];
    if (isVet) {
      reminders.push({
        id: `rem-vet-shift-${new Date().toISOString().slice(0, 10)}`,
        title: "⏰ Shift & Availability Reminder",
        message: "Please review and confirm your on-call hours and availability on the Clinic Calendar.",
        type: "reminder",
        link: "clinic_calendar.html",
      });
      reminders.push({
        id: `rem-vet-notes-${new Date().toISOString().slice(0, 10)}`,
        title: "📋 Patient Records & Consultation Notes",
        message: "Ensure medical findings, treatment plans, and prescriptions are documented for recent visits.",
        type: "reminder",
        link: "records.html",
      });
    }

    if (isReceptionist) {
      reminders.push({
        id: `rem-rec-cal-${new Date().toISOString().slice(0, 10)}`,
        title: "⏰ Daily Calendar Schedule Review",
        message: "Check scheduled appointment slots and confirm upcoming pet check-ins for the day.",
        type: "reminder",
        link: "clinic_calendar.html",
      });
    }

    if (isAccountant) {
      reminders.push({
        id: `rem-acc-recon-${new Date().toISOString().slice(0, 10)}`,
        title: "📊 Daily Revenue & Ledger Reconciliation",
        message: "Reconcile daily billing receipts, cash collections, and open invoices.",
        type: "reminder",
        link: "billing.html",
      });
    }

    if (isInventory) {
      reminders.push({
        id: `rem-inv-audit-${new Date().toISOString().slice(0, 10)}`,
        title: "📋 Pharmacy & Supply Audit",
        message: "Conduct weekly stock check on critical medications and surgical consumables.",
        type: "reminder",
        link: "inventory.html",
      });
    }

    if (isTechnician) {
      reminders.push({
        id: `rem-tech-lab-${new Date().toISOString().slice(0, 10)}`,
        title: "🔬 Lab & Diagnostic Queue Reminder",
        message: "Review incoming test orders, update specimen results, and attach lab logs to patient records.",
        type: "reminder",
        link: "records.html",
      });
    }

    if (isAdmin && !isVet && !isReceptionist && !isAccountant && !isInventory) {
      reminders.push({
        id: `rem-admin-ops-${new Date().toISOString().slice(0, 10)}`,
        title: "🏥 Clinic Operations Overview",
        message: "Monitor real-time patient throughput, doctor schedules, and clinic capacity.",
        type: "reminder",
        link: "Dashboard.html",
      });
    }

    reminders.forEach((rem) => {
      const isRead = readSourceIds.has(rem.id) ? "Y" : "N";
      notifications.push({
        ...rem,
        is_read: isRead,
        created_at: new Date().toISOString(),
      });
    });

    // 10. Deduplicate notifications by ID and sort (unread first, then newest)
    const uniqueMap = new Map();
    notifications.forEach((item) => {
      if (!uniqueMap.has(item.id)) {
        uniqueMap.set(item.id, item);
      }
    });

    const resultList = Array.from(uniqueMap.values());
    resultList.sort((a, b) => {
      if (a.is_read !== b.is_read) {
        return a.is_read === "N" ? -1 : 1;
      }
      return new Date(b.created_at) - new Date(a.created_at);
    });

    return resultList.slice(0, 30);
  });
}

async function markRead(userId, notificationId) {
  return withConnection(async (connection) => {
    const notifIdStr = String(notificationId || "").trim();

    // 1. If it's a usr-* ID or numeric ID in USER_NOTIFICATIONS
    if (notifIdStr.startsWith("usr-")) {
      const dbId = notifIdStr.replace("usr-", "");
      await connection.execute(
        "UPDATE USER_NOTIFICATIONS SET IS_READ = 'Y' WHERE NOTIFICATION_ID = :dbId AND USER_ID = :userId",
        { dbId: Number(dbId), userId },
        { autoCommit: true },
      );
      return;
    }

    if (/^\d+$/.test(notifIdStr)) {
      await connection.execute(
        "UPDATE USER_NOTIFICATIONS SET IS_READ = 'Y' WHERE NOTIFICATION_ID = :dbId AND USER_ID = :userId",
        { dbId: Number(notifIdStr), userId },
        { autoCommit: true },
      );
      return;
    }

    // 2. If it's a staff message (staff-msg-*)
    if (notifIdStr.startsWith("staff-msg-")) {
      const msgId = Number(notifIdStr.replace("staff-msg-", ""));
      if (!isNaN(msgId)) {
        try {
          await connection.execute(
            "UPDATE STAFF_MESSAGES SET IS_READ = 1 WHERE MESSAGE_ID = :msgId",
            { msgId },
            { autoCommit: true },
          );
        } catch (e) {
          console.warn("markRead staff message error:", e.message);
        }
      }
    }

    // 3. If it's a dynamic source ID (apt-*, emg-*, msg-*, inv-*, bill-*, rem-*, staff-msg-*)
    try {
      await connection.execute(
        `INSERT INTO USER_NOTIFICATIONS (USER_ID, TITLE, MESSAGE, TYPE, SOURCE_ID, IS_READ, CREATED_AT)
         SELECT :userId, 'Read notification', :notifId, 'info', :notifId, 'Y', SYSTIMESTAMP FROM DUAL
         WHERE NOT EXISTS (
           SELECT 1 FROM USER_NOTIFICATIONS WHERE USER_ID = :userId AND SOURCE_ID = :notifId
         )`,
        { userId, notifId: notifIdStr },
        { autoCommit: true },
      );
    } catch (e) {
      console.warn("markRead dynamic source insert error:", e.message);
    }
  });
}

async function markAllRead(userId) {
  return withConnection(async (connection) => {
    // 1. Mark existing USER_NOTIFICATIONS as read
    try {
      await connection.execute(
        "UPDATE USER_NOTIFICATIONS SET IS_READ = 'Y' WHERE USER_ID = :userId AND IS_READ = 'N'",
        { userId },
        { autoCommit: true },
      );
    } catch (e) {}

    // 2. Fetch active dynamic items and record them as read
    try {
      const activeItems = await listForUser(userId);
      for (const item of activeItems) {
        if (item.is_read === "N" && item.id) {
          await markRead(userId, item.id);
        }
      }
    } catch (e) {
      console.warn("markAllRead sync error:", e.message);
    }
  });
}

module.exports = { listForUser, markRead, markAllRead };
