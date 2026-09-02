const oracledb = require("oracledb");
try { oracledb.fetchAsString = [oracledb.CLOB]; } catch (e) {}
const { withConnection } = require("../config/database");

const number = (value) => Number(value || 0);
const dateKey = (date) => date.toISOString().slice(0, 10);
const isoWeekKey = (date) => {
  const copy = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  copy.setUTCDate(copy.getUTCDate() + 4 - (copy.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(copy.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((copy - yearStart) / 86400000) + 1) / 7);
  return `${copy.getUTCFullYear()}-${String(week).padStart(2, "0")}`;
};

async function getDashboardData() {
  return withConnection(async (connection) => {
    const [todayRes, upcomingRes, patientsRes, revenueRes, weeklyRes, monthlyRes, serviceRes, growthRes, scheduleRes] = await Promise.all([
      connection.execute("SELECT COUNT(*) FROM APPOINTMENTS WHERE TRUNC(CREATED_AT) = TRUNC(SYSDATE)"),
      connection.execute("SELECT COUNT(*) FROM APPOINTMENTS WHERE STATUS IN ('Pending', 'Confirmed')"),
      connection.execute("SELECT COUNT(*) FROM PATIENTS"),
      connection.execute("SELECT NVL(SUM(AMOUNT), 0) FROM BILLING WHERE STATUS = 'Paid' AND TRUNC(NVL(PAID_AT, ISSUED_AT), 'MM') = TRUNC(SYSDATE, 'MM')"),
      connection.execute("SELECT TO_CHAR(TRUNC(CREATED_AT), 'YYYY-MM-DD') AS DAY_KEY, COUNT(*) AS TOTAL FROM APPOINTMENTS WHERE TRUNC(CREATED_AT) >= TRUNC(SYSDATE) - 6 GROUP BY TRUNC(CREATED_AT)", [], { outFormat: oracledb.OUT_FORMAT_OBJECT }),
      connection.execute("SELECT TO_CHAR(TRUNC(NVL(PAID_AT, ISSUED_AT), 'MM'), 'YYYY-MM') AS MONTH_KEY, NVL(SUM(AMOUNT), 0) AS TOTAL FROM BILLING WHERE STATUS = 'Paid' AND TRUNC(NVL(PAID_AT, ISSUED_AT), 'MM') >= ADD_MONTHS(TRUNC(SYSDATE, 'MM'), -5) GROUP BY TRUNC(NVL(PAID_AT, ISSUED_AT), 'MM') ORDER BY TRUNC(NVL(PAID_AT, ISSUED_AT), 'MM')", [], { outFormat: oracledb.OUT_FORMAT_OBJECT }),
      connection.execute("SELECT NVL(SERVICE, 'Unspecified') AS SERVICE_NAME, COUNT(*) AS TOTAL FROM APPOINTMENTS GROUP BY NVL(SERVICE, 'Unspecified') ORDER BY TOTAL DESC FETCH FIRST 5 ROWS ONLY", [], { outFormat: oracledb.OUT_FORMAT_OBJECT }),
      connection.execute("SELECT TO_CHAR(TRUNC(CREATED_AT, 'IW'), 'IYYY-IW') AS WEEK_KEY, COUNT(DISTINCT PET_NAME) AS TOTAL FROM APPOINTMENTS WHERE TRUNC(CREATED_AT) >= TRUNC(SYSDATE, 'IW') - 49 GROUP BY TRUNC(CREATED_AT, 'IW') ORDER BY TRUNC(CREATED_AT, 'IW')", [], { outFormat: oracledb.OUT_FORMAT_OBJECT }),
      connection.execute("SELECT APPOINTMENT_ID, PET_NAME, PET_SPECIES, OWNER_NAME, OWNER_PHONE, SERVICE, APPOINTMENT_TIME, STATUS, NOTES FROM APPOINTMENTS ORDER BY CREATED_AT DESC FETCH FIRST 20 ROWS ONLY", [], { outFormat: oracledb.OUT_FORMAT_OBJECT }),
    ]);

    const today = new Date();
    const weeklyDates = Array.from({ length: 7 }, (_, index) => new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6 + index));
    const weeklyMap = new Map((weeklyRes.rows || []).map((row) => [row.DAY_KEY, number(row.TOTAL)]));
    const monthlyMap = new Map((monthlyRes.rows || []).map((row) => [row.MONTH_KEY, number(row.TOTAL)]));
    const monthlyDates = Array.from({ length: 6 }, (_, index) => new Date(today.getFullYear(), today.getMonth() - 5 + index, 1));
    const growthMap = new Map((growthRes.rows || []).map((row) => [row.WEEK_KEY, number(row.TOTAL)]));
    const growthWeeks = Array.from({ length: 8 }, (_, index) => new Date(today.getFullYear(), today.getMonth(), today.getDate() - 49 + index * 7));

    return {
      stats: { todayAppointments: number(todayRes.rows?.[0]?.[0]), upcomingAppointments: number(upcomingRes.rows?.[0]?.[0]), totalPatients: number(patientsRes.rows?.[0]?.[0]), monthlyRevenue: number(revenueRes.rows?.[0]?.[0]) },
      weekly: { labels: weeklyDates.map((date) => date.toLocaleDateString("en", { weekday: "short" })), data: weeklyDates.map((date) => weeklyMap.get(dateKey(date)) || 0) },
      revenue: { labels: monthlyDates.map((date) => date.toLocaleDateString("en", { month: "short" })), data: monthlyDates.map((date) => monthlyMap.get(dateKey(date).slice(0, 7)) || 0) },
      services: { labels: (serviceRes.rows || []).map((row) => row.SERVICE_NAME), data: (serviceRes.rows || []).map((row) => number(row.TOTAL)) },
      growth: { labels: growthWeeks.map((date) => date.toLocaleDateString("en", { month: "short", day: "numeric" })), newPatients: growthWeeks.map((date) => growthMap.get(isoWeekKey(date)) || 0), returningPatients: Array(8).fill(0) },
      schedule: (scheduleRes.rows || []).map((row) => ({ id: `APT-${String(row.APPOINTMENT_ID).padStart(3, "0")}`, patient: `${row.PET_NAME || "Pet"} (${row.PET_SPECIES || "Unknown"})`, owner: row.OWNER_NAME || "Pet Owner", phone: row.OWNER_PHONE || "", service: row.SERVICE || "Unspecified", vet: "Unassigned", time: row.APPOINTMENT_TIME || "—", status: row.STATUS || "Pending", notes: row.NOTES || "" })),
    };
  });
}

module.exports = { getDashboardData };
