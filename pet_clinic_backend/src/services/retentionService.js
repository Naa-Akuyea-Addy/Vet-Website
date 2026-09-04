const billingModel = require("../models/billingModel");
const appointmentModel = require("../models/appointmentModel");

const DAY_IN_MS = 24 * 60 * 60 * 1000;

function getApprovedRetentionYears(settingName) {
  const rawValue = String(process.env[settingName] || "").trim();
  const years = Number(rawValue);
  return Number.isInteger(years) && years > 0 ? years : null;
}

async function purgeExpiredBillingRecords() {
  const years = getApprovedRetentionYears("BILLING_RETENTION_YEARS");
  if (!years) return { enabled: false, rowsDeleted: 0 };

  const result = await billingModel.purgeExpired(years);
  const rowsDeleted = result.rowsAffected || 0;
  console.log(`Billing retention completed: ${rowsDeleted} record(s) older than ${years} year(s) deleted.`);
  return { enabled: true, rowsDeleted };
}

async function purgeExpiredAppointments() {
  const years = getApprovedRetentionYears("APPOINTMENT_RETENTION_YEARS");
  if (!years) return { enabled: false, rowsDeleted: 0 };

  const result = await appointmentModel.purgeExpired(years);
  const rowsDeleted = result.rowsAffected || 0;
  console.log(`Appointment retention completed: ${rowsDeleted} record(s) older than ${years} year(s) deleted.`);
  return { enabled: true, rowsDeleted };
}

function startRetentionSchedule() {
  const billingYears = getApprovedRetentionYears("BILLING_RETENTION_YEARS");
  const appointmentYears = getApprovedRetentionYears("APPOINTMENT_RETENTION_YEARS");
  if (!billingYears && !appointmentYears) {
    console.log("Retention is disabled. Set a retention value only after the approved retention period is known.");
    return;
  }

  const runRetention = () => Promise.all([
    purgeExpiredBillingRecords(),
    purgeExpiredAppointments(),
  ]).catch((error) => console.error("Retention run failed:", error));
  runRetention();
  setInterval(() => {
    runRetention();
  }, DAY_IN_MS).unref();
}

module.exports = { startRetentionSchedule, purgeExpiredBillingRecords, purgeExpiredAppointments };
