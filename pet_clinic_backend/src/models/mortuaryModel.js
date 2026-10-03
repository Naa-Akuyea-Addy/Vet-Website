const oracledb = require("oracledb");
const { withConnection } = require("../config/database");

async function getAllMortuaryRecords() {
  return withConnection(async (connection) => {
    const result = await connection.execute(
      `SELECT record_id, mortuary_number, patient_name, owner_name, species, breed,
              age, entry_date, cause_of_death, disposition, status, storage_location,
              pickup_date, notes
       FROM mortuary_records
       ORDER BY record_id DESC`,
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT },
    );
    return result.rows || [];
  });
}

async function createMortuaryRecord(recordData) {
  return withConnection(async (connection) => {
    const result = await connection.execute(
      `INSERT INTO mortuary_records (
         patient_name, owner_name, species, breed, age, entry_date,
         cause_of_death, disposition, status, storage_location, pickup_date, notes
       ) VALUES (
         :patient_name, :owner_name, :species, :breed, :age, :entry_date,
         :cause_of_death, :disposition, :status, :storage_location, :pickup_date, :notes
       ) RETURNING record_id INTO :record_id`,
      {
        ...recordData,
        record_id: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT },
      },
      { autoCommit: true },
    );
    return { record_id: result.outBinds.record_id[0] };
  });
}

async function updateMortuaryRecord(recordId, updateData) {
  return withConnection((connection) =>
    connection.execute(
      `UPDATE mortuary_records
       SET patient_name = :patient_name,
           owner_name = :owner_name,
           species = :species,
           breed = :breed,
           age = :age,
           entry_date = :entry_date,
           cause_of_death = :cause_of_death,
           disposition = :disposition,
           status = :status,
           storage_location = :storage_location,
           pickup_date = :pickup_date,
           notes = :notes,
           updated_at = SYSTIMESTAMP
       WHERE record_id = :record_id`,
      { ...updateData, record_id: Number(recordId) },
      { autoCommit: true },
    ).then((result) => result.rowsAffected > 0),
  );
}

async function deleteMortuaryRecord(recordId) {
  return withConnection((connection) =>
    connection.execute(
      `DELETE FROM mortuary_records WHERE record_id = :record_id`,
      { record_id: Number(recordId) },
      { autoCommit: true },
    ).then((result) => result.rowsAffected > 0),
  );
}

module.exports = {
  getAllMortuaryRecords,
  createMortuaryRecord,
  updateMortuaryRecord,
  deleteMortuaryRecord,
};
