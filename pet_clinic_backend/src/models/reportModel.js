const { withConnection } = require("../config/database");
const oracledb = require("oracledb");

async function summary() {
  return withConnection(async (connection) => {
    const sql = `
      SELECT 
        (SELECT COUNT(*) FROM appointments) AS TOTAL_APPOINTMENTS,
        (SELECT COUNT(*) FROM patients) AS ACTIVE_PATIENTS,
        (SELECT SUM(amount) FROM billing WHERE status = 'Paid') AS TOTAL_REVENUE,
        (SELECT AVG(amount) FROM billing WHERE status = 'Paid') AS AVG_VISIT_VALUE,
        (SELECT COUNT(*) FROM inventory WHERE quantity <= reorder_level) AS LOW_STOCK,
        (SELECT COUNT(*) FROM mortuary_records WHERE status != 'completed') AS MORT_COUNT
      FROM DUAL
    `;
    const result = await connection.execute(sql, [], { outFormat: oracledb.OUT_FORMAT_OBJECT });
    const row = result.rows[0];

    return {
      totalAppointments: row.TOTAL_APPOINTMENTS || 0,
      activePatients: row.ACTIVE_PATIENTS || 0,
      totalRevenue: row.TOTAL_REVENUE || 0,
      avgVisitValue: row.AVG_VISIT_VALUE || 0,
      lowStockValue: row.LOW_STOCK || 0,
      mortuaryValue: `${row.MORT_COUNT || 0}/12`
    };
  });
}



// Function to fetch chart data from database
async function chartData() {
  return withConnection(async (connection) => {
    // 1. Service Distribution (Top 5 services billed)
    const serviceDistResult = await connection.execute(
      "SELECT description AS SERVICE, COUNT(*) AS COUNT FROM billing WHERE description IS NOT NULL GROUP BY description ORDER BY COUNT DESC FETCH FIRST 5 ROWS ONLY",
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    const serviceDistribution = serviceDistResult.rows;

    // 2. Inventory Health (Top 5 items)
    const invHealthResult = await connection.execute(
      "SELECT item_name AS ITEM, quantity AS CURRENT_STOCK, reorder_level AS BUFFER_FLOOR FROM inventory ORDER BY quantity ASC FETCH FIRST 5 ROWS ONLY",
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    const inventoryHealth = invHealthResult.rows;

    // 3. Bookings created by day (Last 7 days)
    const apptsByDayResult = await connection.execute(
      "SELECT TO_CHAR(created_at, 'Day') AS DAY_NAME, COUNT(*) AS COUNT FROM appointments WHERE created_at >= SYSTIMESTAMP - INTERVAL '7' DAY GROUP BY TO_CHAR(created_at, 'Day'), TRUNC(created_at) ORDER BY TRUNC(created_at)",
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    const appointmentsByDay = apptsByDayResult.rows;

    // 4. Revenue Trend (Last 7 days of paid billing)
    const revenueTrendResult = await connection.execute(
      "SELECT TO_CHAR(paid_at, 'Day') AS DAY_NAME, SUM(amount) AS TOTAL FROM billing WHERE status = 'Paid' AND paid_at >= SYSDATE - 7 GROUP BY TO_CHAR(paid_at, 'Day'), TRUNC(paid_at) ORDER BY TRUNC(paid_at)",
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    const revenueTrend = revenueTrendResult.rows;

    // 5. Staff Performance (appointments per vet)
    const staffPerfResult = await connection.execute(
      "SELECT u.full_name AS VET_NAME, COUNT(a.appointment_id) AS APPT_COUNT FROM appointments a JOIN users u ON a.veterinarian_id = u.user_id GROUP BY u.full_name ORDER BY APPT_COUNT DESC FETCH FIRST 5 ROWS ONLY",
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    const staffPerformance = staffPerfResult.rows;

    // 6. Outstanding Balances (Pending and overdue invoices over time)
    // We group by month/week, but for simplicity let's group by Status or just a simple aggregate of top Unpaid ones
    // We will do total unpaid amount by Day for the last 7 days
    const outstandingResult = await connection.execute(
      "SELECT TO_CHAR(issued_at, 'Day') AS DAY_NAME, SUM(amount) AS TOTAL_UNPAID FROM billing WHERE status IN ('Pending', 'Overdue') AND issued_at >= SYSTIMESTAMP - INTERVAL '7' DAY GROUP BY TO_CHAR(issued_at, 'Day'), TRUNC(issued_at) ORDER BY TRUNC(issued_at)",
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    const outstandingBalances = outstandingResult.rows;

    return {
      serviceDistribution,
      inventoryHealth,
      appointmentsByDay,
      revenueTrend,
      staffPerformance,
      outstandingBalances
    };
  });
}

module.exports = { summary, chartData };
