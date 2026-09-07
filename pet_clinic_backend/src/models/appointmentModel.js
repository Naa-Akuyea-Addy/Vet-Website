const oracledb = require("oracledb");
try {
  oracledb.fetchAsString = [oracledb.CLOB];
} catch (e) {}
const { withConnection } = require("../config/database");

const table = "APPOINTMENTS";

async function list() {
  return withConnection((c) =>
    c
      .execute(`SELECT a.*, u.FULL_NAME AS VET_NAME
                FROM ${table} a
                LEFT JOIN USERS u ON u.USER_ID = a.VETERINARIAN_ID
                ORDER BY a.APPOINTMENT_ID DESC`, [], {
        outFormat: oracledb.OUT_FORMAT_OBJECT,
      })
      .then((r) => r.rows || []),
  );
}

async function findById(id) {
  return withConnection((c) =>
    c
      .execute(
        `SELECT a.*, u.FULL_NAME AS VET_NAME
         FROM ${table} a
         LEFT JOIN USERS u ON u.USER_ID = a.VETERINARIAN_ID
         WHERE a.APPOINTMENT_ID = :id`,
        { id },
        { outFormat: oracledb.OUT_FORMAT_OBJECT },
      )
      .then((r) => (r.rows && r.rows[0]) || null),
  );
}

async function findLeastBusyVeterinarianId(connection) {
  const result = await connection.execute(
    `SELECT USER_ID
     FROM (
       SELECT u.USER_ID, COUNT(a.APPOINTMENT_ID) AS ACTIVE_APPOINTMENTS
       FROM STAFF s
       JOIN USERS u
         ON (s.USER_ID = u.USER_ID OR LOWER(s.EMAIL) = LOWER(u.EMAIL))
       LEFT JOIN APPOINTMENTS a
         ON a.VETERINARIAN_ID = u.USER_ID
        AND a.STATUS IN ('Pending', 'Confirmed')
       WHERE LOWER(NVL(s.STATUS, 'Active')) = 'active'
         AND LOWER(NVL(u.STATUS, 'Active')) = 'active'
         AND (
           LOWER(NVL(s.JOB_TITLE, '')) LIKE '%vet%'
           OR LOWER(NVL(s.JOB_TITLE, '')) LIKE '%surgeon%'
           OR LOWER(NVL(s.DEPARTMENT, '')) LIKE '%veterinary%'
           OR LOWER(NVL(s.DEPARTMENT, '')) LIKE '%clinical%'
         )
       GROUP BY u.USER_ID
       ORDER BY ACTIVE_APPOINTMENTS ASC, u.USER_ID ASC
     )
     WHERE ROWNUM = 1`,
    [],
    { outFormat: oracledb.OUT_FORMAT_OBJECT },
  );
  return result.rows?.[0]?.USER_ID || null;
}

async function findOrCreatePatientId(connection, data) {
  if (data.patient_id) return Number(data.patient_id);

  const petName = data.pet_name || data.patient || "Pet";
  const ownerName = data.owner_name || data.owner || "Owner";
  const ownerPhone = data.owner_phone || data.phone || "";
  const existing = await connection.execute(
    `SELECT PATIENT_ID
     FROM PATIENTS
     WHERE UPPER(TRIM(PET_NAME)) = UPPER(TRIM(:pet_name))
       AND UPPER(TRIM(OWNER_NAME)) = UPPER(TRIM(:owner_name))
       AND NVL(REGEXP_REPLACE(OWNER_PHONE, '[^0-9]', ''), '') = NVL(REGEXP_REPLACE(:owner_phone, '[^0-9]', ''), '')
     FETCH FIRST 1 ROWS ONLY`,
    { pet_name: petName, owner_name: ownerName, owner_phone: ownerPhone },
    { outFormat: oracledb.OUT_FORMAT_OBJECT },
  );
  if (existing.rows?.[0]?.PATIENT_ID) return existing.rows[0].PATIENT_ID;

  const created = await connection.execute(
    `INSERT INTO PATIENTS (PET_NAME, PET_SPECIES, PET_AGE, OWNER_NAME, OWNER_PHONE)
     VALUES (:pet_name, :pet_species, :pet_age, :owner_name, :owner_phone)
     RETURNING PATIENT_ID INTO :patient_id`,
    {
      pet_name: petName,
      pet_species: data.pet_species || "Dog",
      pet_age: data.pet_age || "1 year",
      owner_name: ownerName,
      owner_phone: ownerPhone,
      patient_id: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
    },
  );
  return created.outBinds?.patient_id?.[0] || null;
}

async function create(data) {
  return withConnection(async (c) => {
    const veterinarianId = data.veterinarian_id || await findLeastBusyVeterinarianId(c);
    const patientId = await findOrCreatePatientId(c, data);
    const result = await c.execute(
      `INSERT INTO ${table} (PATIENT_ID, PET_NAME, PET_SPECIES, PET_AGE, OWNER_NAME, OWNER_PHONE, VISIT_REASON, SERVICE, APPOINTMENT_TIME, STATUS, NOTES, VETERINARIAN_ID)
       VALUES (:patient_id, :pet_name, :pet_species, :pet_age, :owner_name, :owner_phone, :visit_reason, :service,
               :appointment_time, NVL(:status, 'Pending'), :notes, :veterinarian_id)
       RETURNING APPOINTMENT_ID INTO :appointment_id`,
      {
        patient_id: patientId,
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
        veterinarian_id: veterinarianId,
        appointment_id: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
      },
      { autoCommit: true },
    );
    return {
      appointmentId: result.outBinds?.appointment_id?.[0] || null,
      patientId,
      veterinarianId,
    };
  });
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

async function update(id, data) {
  return withConnection((c) =>
    c.execute(
      `UPDATE ${table}
       SET PET_NAME = :pet_name,
           PATIENT_ID = NVL(:patient_id, PATIENT_ID),
           PET_SPECIES = :pet_species,
           PET_AGE = :pet_age,
           OWNER_NAME = :owner_name,
           OWNER_PHONE = :owner_phone,
           VISIT_REASON = :visit_reason,
           SERVICE = :service,
           APPOINTMENT_TIME = :appointment_time,
           STATUS = :status,
           NOTES = :notes,
           VETERINARIAN_ID = NVL(:veterinarian_id, VETERINARIAN_ID)
       WHERE APPOINTMENT_ID = :id`,
      {
        id,
        patient_id: data.patient_id || null,
        pet_name: data.pet_name || data.patient || null,
        pet_species: data.pet_species || null,
        pet_age: data.pet_age || null,
        owner_name: data.owner_name || data.owner || null,
        owner_phone: data.owner_phone || data.phone || null,
        visit_reason: data.visit_reason || data.type || null,
        service: data.service || data.type || null,
        appointment_time: data.appointment_time || (data.date ? `${data.date} ${data.time || ''}` : null),
        status: data.status || null,
        notes: data.notes || null,
        veterinarian_id: data.veterinarian_id || null,
      },
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

async function purgeExpired(retentionYears) {
  return withConnection((c) =>
    c.execute(
      `DELETE FROM ${table}
       WHERE CREATED_AT < ADD_MONTHS(SYSTIMESTAMP, -:months)`,
      { months: retentionYears * 12 },
      { autoCommit: true },
    ),
  );
}

module.exports = { list, create, updateStatus, update, remove, purgeExpired };
