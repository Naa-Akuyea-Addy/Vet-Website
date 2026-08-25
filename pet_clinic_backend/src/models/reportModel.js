const { withConnection } = require("../config/database");
async function summary() {
  return withConnection((c) =>
    c
      .execute("SELECT COUNT(*) AS TOTAL_APPOINTMENTS FROM APPOINTMENTS", [], {
        outFormat: 4002,
      })
      .then((r) => r.rows[0]),
  );
}
module.exports = { summary };
