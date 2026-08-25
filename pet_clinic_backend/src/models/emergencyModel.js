const { withConnection } = require("../config/database");
async function list() {
  return withConnection((c) =>
    c
      .execute("SELECT * FROM EMERGENCY_CASES", [], { outFormat: 4002 })
      .then((r) => r.rows),
  );
}
async function create(data) {
  return withConnection((c) =>
    c.execute(
      "INSERT INTO EMERGENCY_CASES (PATIENT_NAME, OWNER_NAME, DESCRIPTION, STATUS) VALUES (:patient_name, :owner_name, :description, :status)",
      data,
      { autoCommit: true },
    ),
  );
}
module.exports = { list, create };
