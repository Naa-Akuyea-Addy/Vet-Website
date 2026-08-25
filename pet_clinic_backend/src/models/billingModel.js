const { withConnection } = require("../config/database");
async function list() {
  return withConnection((c) =>
    c
      .execute("SELECT * FROM BILLING", [], { outFormat: 4002 })
      .then((r) => r.rows),
  );
}
async function create(data) {
  return withConnection((c) =>
    c.execute(
      "INSERT INTO BILLING (PATIENT_ID, AMOUNT, STATUS, DESCRIPTION) VALUES (:patient_id, :amount, :status, :description)",
      data,
      { autoCommit: true },
    ),
  );
}
module.exports = { list, create };
