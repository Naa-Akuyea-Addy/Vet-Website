const oracledb = require("oracledb");
try {
  oracledb.fetchAsString = [oracledb.CLOB];
} catch (e) {}
const { withConnection } = require("../config/database");

const table = "APPOINTMENTS";

async function list() {
  return withConnection((c) =>
    c
      .execute(`SELECT * FROM ${table} ORDER BY APPOINTMENT_ID DESC`, [], {
        outFormat: oracledb.OUT_FORMAT_OBJECT,
      })
      .then((r) => r.rows || []),
  );
}

async function create(data) {
  return withConnection((c) =>
    c.execute(
      `INSERT INTO ${table} (PET_NAME, PET_SPECIES, PET_AGE, OWNER_NAME, OWNER_PHONE, VISIT_REASON, SERVICE, APPOINTMENT_TIME, STATUS, NOTES)
       VALUES (:pet_name, :pet_species, :pet_age, :owner_name, :owner_phone, :visit_reason, :service,
               :appointment_time, NVL(:status, 'Pending'), :notes)`,
      {
        pet_name: data.pet_name || data.patient || 'Pet',
        pet_species: data.pet_species || 'Dog',
        pet_age: data.pet_age || '1 year',
        owner_name: data.owner_name || data.owner || 'Owner',
        owner_phone: data.owner_phone || data.phone || '',
        visit_reason: data.visit_reason || data.type || 'Checkup',
        service: data.service || data.type || 'General Checkup',
        appointment_time: data.appointment_time || (data.date ? `${data.date} ${data.time || ''}` : '09:00 AM'),
        status: data.status || 'Pending',
        notes: data.notes || '',
      },
      { autoCommit: true },
    ),
  );
}

async function updateStatus(id, status) {
  return withConnection((c) =>
    c.execute(
      `UPDATE ${table} SET STATUS = :status WHERE APPOINTMENT_ID = :id`,
      { id, status },
      { autoCommit: true },
    ),
  );
}

async function remove(id) {
  return withConnection((c) =>
    c.execute(
      `DELETE FROM ${table} WHERE APPOINTMENT_ID = :id`,
      { id },
      { autoCommit: true },
    ),
  );
}

module.exports = { list, create, updateStatus, remove };
