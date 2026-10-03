const { withConnection } = require('./src/config/database');
const oracledb = require('oracledb');

async function run() {
  return withConnection(async (c) => {
    try {
      const sql = `
        SELECT 
          (SELECT COUNT(*) FROM appointments) AS TOTAL_APPOINTMENTS,
          (SELECT COUNT(*) FROM patients) AS ACTIVE_PATIENTS,
          (SELECT SUM(amount) FROM billing WHERE status = 'Paid') AS TOTAL_REVENUE,
          (SELECT AVG(amount) FROM billing WHERE status = 'Paid') AS AVG_VISIT_VALUE,
          (SELECT COUNT(*) FROM inventory WHERE quantity <= reorder_level) AS LOW_STOCK,
          (SELECT COUNT(*) FROM mortuary_records WHERE status = 'in_storage') AS MORT_COUNT
        FROM DUAL
      `;
      const r = await c.execute(sql, [], { outFormat: oracledb.OUT_FORMAT_OBJECT });
      console.log("Success:", r.rows);
    } catch (e) {
      console.error("DB Error:", e);
    }
  });
}

run().then(() => process.exit(0)).catch(e => {
  console.error(e);
  process.exit(1);
});