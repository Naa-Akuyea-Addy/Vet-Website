const { withConnection } = require("../config/database");
async function list() {
  return withConnection((c) =>
    c
      .execute("SELECT * FROM PATIENTS", [], { outFormat: 4002 })
      .then((r) => r.rows),
  );
}
async function findById(id) {
  return withConnection((c) =>
    c
      .execute(
        "SELECT * FROM PATIENTS WHERE PATIENT_ID = :id",
        { id },
        { outFormat: 4002 },
      )
      .then((r) => r.rows[0] || null),
  );
}
module.exports = { list, findById };
