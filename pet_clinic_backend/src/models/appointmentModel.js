const { withConnection } = require("../config/database");
const table = "APPOINTMENTS";
async function list() {
  return withConnection((c) =>
    c
      .execute(`SELECT * FROM ${table}`, [], { outFormat: 4002 })
      .then((r) => r.rows),
  );
}
async function create(data) {
  return withConnection((c) =>
    c.execute(
      `INSERT INTO ${table} (PET_NAME, PET_SPECIES, PET_AGE, OWNER_NAME, OWNER_PHONE, VISIT_REASON, SERVICE, APPOINTMENT_TIME)
       VALUES (:pet_name, :pet_species, :pet_age, :owner_name, :owner_phone, :visit_reason, :service,
               :appointment_time)`,
      data,
      { autoCommit: true },
    ),
  );
}
module.exports = { list, create };
