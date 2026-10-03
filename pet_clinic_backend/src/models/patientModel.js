const oracledb = require("oracledb");
try {
  oracledb.fetchAsString = [oracledb.CLOB];
} catch (e) {}
const { withConnection } = require("../config/database");

async function list() {
  return withConnection((c) =>
    c
      .execute(
        `SELECT p.PATIENT_ID, p.PATIENT_NUMBER, p.PET_NAME, p.PET_SPECIES, p.PET_BREED, p.PET_AGE, p.PET_AGE_VALUE, p.PET_AGE_UNIT,
                p.SEX, p.OWNER_NAME, p.OWNER_PHONE, p.OWNER_EMAIL, p.MEDICAL_NOTES, 
                NVL(p.VACCINATION_STATUS, 'VACCINATED') AS VACCINATION_STATUS,
                NVL(p.PATIENT_STATUS, 'Active') AS PATIENT_STATUS,
                p.CREATED_AT,
                (SELECT COUNT(*) FROM EMERGENCY_CASES ec 
                 WHERE ec.PATIENT_ID = p.PATIENT_ID 
                   AND (ec.STATUS IS NULL OR LOWER(ec.STATUS) NOT IN ('discharged', 'resolved', 'closed'))) AS ACTIVE_EMERGENCY_COUNT,
                (SELECT MAX(ec.PRIORITY) FROM EMERGENCY_CASES ec 
                 WHERE ec.PATIENT_ID = p.PATIENT_ID 
                   AND (ec.STATUS IS NULL OR LOWER(ec.STATUS) NOT IN ('discharged', 'resolved', 'closed'))) AS EMERGENCY_PRIORITY,
                (SELECT MAX(ec.STATUS) FROM EMERGENCY_CASES ec 
                 WHERE ec.PATIENT_ID = p.PATIENT_ID 
                   AND (ec.STATUS IS NULL OR LOWER(ec.STATUS) NOT IN ('discharged', 'resolved', 'closed'))) AS EMERGENCY_STATUS,
                (SELECT MAX(ec.EMERGENCY_ID) FROM EMERGENCY_CASES ec 
                 WHERE ec.PATIENT_ID = p.PATIENT_ID 
                   AND (ec.STATUS IS NULL OR LOWER(ec.STATUS) NOT IN ('discharged', 'resolved', 'closed'))) AS EMERGENCY_ID
         FROM PATIENTS p 
         ORDER BY p.PATIENT_ID DESC`,
        [],
        { outFormat: oracledb.OUT_FORMAT_OBJECT },
      )
      .then((r) => r.rows || []),
  );
}

async function findById(id) {
  return withConnection((c) =>
    c
      .execute(
        `SELECT p.PATIENT_ID, p.PATIENT_NUMBER, p.PET_NAME, p.PET_SPECIES, p.PET_BREED, p.PET_AGE, p.PET_AGE_VALUE, p.PET_AGE_UNIT,
                p.SEX, p.OWNER_NAME, p.OWNER_PHONE, p.OWNER_EMAIL, p.MEDICAL_NOTES, 
                NVL(p.VACCINATION_STATUS, 'VACCINATED') AS VACCINATION_STATUS,
                NVL(p.PATIENT_STATUS, 'Active') AS PATIENT_STATUS,
                p.CREATED_AT,
                (SELECT COUNT(*) FROM EMERGENCY_CASES ec 
                 WHERE ec.PATIENT_ID = p.PATIENT_ID 
                   AND (ec.STATUS IS NULL OR LOWER(ec.STATUS) NOT IN ('discharged', 'resolved', 'closed'))) AS ACTIVE_EMERGENCY_COUNT,
                (SELECT MAX(ec.PRIORITY) FROM EMERGENCY_CASES ec 
                 WHERE ec.PATIENT_ID = p.PATIENT_ID 
                   AND (ec.STATUS IS NULL OR LOWER(ec.STATUS) NOT IN ('discharged', 'resolved', 'closed'))) AS EMERGENCY_PRIORITY,
                (SELECT MAX(ec.STATUS) FROM EMERGENCY_CASES ec 
                 WHERE ec.PATIENT_ID = p.PATIENT_ID 
                   AND (ec.STATUS IS NULL OR LOWER(ec.STATUS) NOT IN ('discharged', 'resolved', 'closed'))) AS EMERGENCY_STATUS,
                (SELECT MAX(ec.EMERGENCY_ID) FROM EMERGENCY_CASES ec 
                 WHERE ec.PATIENT_ID = p.PATIENT_ID 
                   AND (ec.STATUS IS NULL OR LOWER(ec.STATUS) NOT IN ('discharged', 'resolved', 'closed'))) AS EMERGENCY_ID
         FROM PATIENTS p 
         WHERE p.PATIENT_ID = :id`,
        { id: Number(id) },
        { outFormat: oracledb.OUT_FORMAT_OBJECT },
      )
      .then((r) => (r.rows && r.rows[0]) || null),
  );
}

async function create(data) {
  return withConnection(async (c) => {
    const petName = data.pet_name || data.name || "Pet";
    const ownerName = data.owner_name || data.owner || "Owner";
    const ownerPhone = (data.owner_phone || data.phone || "").toString().trim();
    const ownerEmail = (data.owner_email || data.email || "").toString().trim();

    // Check if patient already exists
    const existing = await c.execute(
      `SELECT PATIENT_ID, OWNER_PHONE, OWNER_EMAIL
       FROM PATIENTS
       WHERE UPPER(TRIM(PET_NAME)) = UPPER(TRIM(:pet_name))
         AND UPPER(TRIM(OWNER_NAME)) = UPPER(TRIM(:owner_name))
       ORDER BY PATIENT_ID DESC
       FETCH FIRST 1 ROWS ONLY`,
      { pet_name: petName, owner_name: ownerName },
      { outFormat: oracledb.OUT_FORMAT_OBJECT },
    );

    if (existing?.rows?.[0]?.PATIENT_ID) {
      const existingId = existing.rows[0].PATIENT_ID;
      const currentPhone = (existing.rows[0].OWNER_PHONE || "").toString().trim();
      const currentEmail = (existing.rows[0].OWNER_EMAIL || "").toString().trim();
      
      // Update missing phone or email
      if ((!currentPhone && ownerPhone) || (!currentEmail && ownerEmail)) {
        await c.execute(
          `UPDATE PATIENTS 
           SET OWNER_PHONE = COALESCE(:owner_phone, OWNER_PHONE),
               OWNER_EMAIL = COALESCE(:owner_email, OWNER_EMAIL)
           WHERE PATIENT_ID = :id`,
          {
            owner_phone: ownerPhone || null,
            owner_email: ownerEmail || null,
            id: existingId,
          },
          { autoCommit: true },
        );
      }
      return { patientId: existingId, isExisting: true };
    }

    let ageValue = data.pet_age_value !== undefined && data.pet_age_value !== null ? Number(data.pet_age_value) : null;
    let ageUnit = data.pet_age_unit || "years";
    let formattedAge = data.pet_age || data.age || null;
    if (ageValue === null && formattedAge) {
      const match = String(formattedAge).match(/\d+/);
      if (match) ageValue = parseInt(match[0], 10);
      if (String(formattedAge).toLowerCase().includes("month")) ageUnit = "months";
      else if (String(formattedAge).toLowerCase().includes("week")) ageUnit = "weeks";
      else ageUnit = "years";
    }
    if (!formattedAge && ageValue !== null) {
      formattedAge = `${ageValue} ${ageUnit}`;
    }
    if (!formattedAge) formattedAge = "1 year";

    return c.execute(
      `INSERT INTO PATIENTS (PET_NAME, PET_SPECIES, PET_BREED, PET_AGE, PET_AGE_VALUE, PET_AGE_UNIT, SEX, OWNER_NAME, OWNER_PHONE, OWNER_EMAIL, MEDICAL_NOTES, VACCINATION_STATUS, PATIENT_STATUS)
       VALUES (:pet_name, :pet_species, :pet_breed, :pet_age, :pet_age_value, :pet_age_unit, :sex, :owner_name, :owner_phone, :owner_email, :medical_notes, :vaccination_status, :patient_status)`,
      {
        pet_name: petName,
        pet_species: data.pet_species || data.species || "Dog",
        pet_breed: data.pet_breed || data.breed || "Mixed Breed",
        pet_age: formattedAge,
        pet_age_value: ageValue,
        pet_age_unit: ageUnit,
        sex: data.sex || "Male",
        owner_name: ownerName,
        owner_phone: ownerPhone,
        owner_email: ownerEmail,
        medical_notes: data.medical_notes || data.notes || "",
        vaccination_status: data.vaccination_status || "VACCINATED",
        patient_status: data.patient_status || "Active",
      },
      { autoCommit: true },
    );
  });
}

async function update(id, data) {
  return withConnection(async (c) => {
    let ageValue = data.pet_age_value !== undefined && data.pet_age_value !== null ? Number(data.pet_age_value) : null;
    let ageUnit = data.pet_age_unit || "years";
    let formattedAge = data.pet_age || data.age || null;
    if (ageValue === null && formattedAge) {
      const match = String(formattedAge).match(/\d+/);
      if (match) ageValue = parseInt(match[0], 10);
      if (String(formattedAge).toLowerCase().includes("month")) ageUnit = "months";
      else if (String(formattedAge).toLowerCase().includes("week")) ageUnit = "weeks";
      else ageUnit = "years";
    }
    if (!formattedAge && ageValue !== null) {
      formattedAge = `${ageValue} ${ageUnit}`;
    }

    const result = await c.execute(
      `UPDATE PATIENTS 
       SET PET_NAME = :pet_name, PET_SPECIES = :pet_species, PET_BREED = :pet_breed, 
           PET_AGE = NVL(:pet_age, PET_AGE),
           PET_AGE_VALUE = NVL(:pet_age_value, PET_AGE_VALUE),
           PET_AGE_UNIT = NVL(:pet_age_unit, PET_AGE_UNIT),
           SEX = :sex, OWNER_NAME = :owner_name, OWNER_PHONE = :owner_phone, OWNER_EMAIL = :owner_email, 
           MEDICAL_NOTES = :medical_notes,
           VACCINATION_STATUS = COALESCE(:vaccination_status, VACCINATION_STATUS),
           PATIENT_STATUS = COALESCE(:patient_status, PATIENT_STATUS)
       WHERE PATIENT_ID = :id`,
      {
        id: Number(id),
        pet_name: data.pet_name || data.name,
        pet_species: data.pet_species || data.species,
        pet_breed: data.pet_breed || data.breed,
        pet_age: formattedAge,
        pet_age_value: ageValue,
        pet_age_unit: ageUnit,
        sex: data.sex || "Male",
        owner_name: data.owner_name || data.owner,
        owner_phone: data.owner_phone || data.phone,
        owner_email: data.owner_email || data.email,
        medical_notes: data.medical_notes || data.notes,
        vaccination_status: data.vaccination_status || null,
        patient_status: data.patient_status || null,
      },
      { autoCommit: true },
    );

    // Sync back to APPOINTMENTS table so calendar events stay updated
    await c.execute(
      `UPDATE APPOINTMENTS
       SET PET_NAME = :pet_name,
           PET_SPECIES = :pet_species,
           PET_AGE = NVL(:pet_age, PET_AGE),
           PET_AGE_VALUE = NVL(:pet_age_value, PET_AGE_VALUE),
           PET_AGE_UNIT = NVL(:pet_age_unit, PET_AGE_UNIT),
           OWNER_NAME = :owner_name,
           OWNER_PHONE = :owner_phone
       WHERE PATIENT_ID = :id`,
      {
        id: Number(id),
        pet_name: data.pet_name || data.name,
        pet_species: data.pet_species || data.species,
        pet_age: formattedAge,
        pet_age_value: ageValue,
        pet_age_unit: ageUnit,
        owner_name: data.owner_name || data.owner,
        owner_phone: data.owner_phone || data.phone,
      },
      { autoCommit: true }
    );

    return result;
  });
}

async function updateVaccinationStatus(id, status) {
  return withConnection((c) =>
    c.execute(
      `UPDATE PATIENTS SET VACCINATION_STATUS = :status WHERE PATIENT_ID = :id`,
      { id: Number(id), status: String(status).toUpperCase() },
      { autoCommit: true },
    ),
  );
}

async function updatePatientStatus(id, status) {
  return withConnection(async (c) => {
    const patientId = Number(id);
    const normalizedStatus = String(status).trim();
    try {
      const result = await c.execute(
        `UPDATE PATIENTS SET PATIENT_STATUS = :status WHERE PATIENT_ID = :id`,
        { id: patientId, status: normalizedStatus },
        { autoCommit: false },
      );

      if (normalizedStatus.toLowerCase() === "deceased" && result.rowsAffected > 0) {
        const patientResult = await c.execute(
          `SELECT PET_NAME, OWNER_NAME, PET_SPECIES, PET_BREED, PET_AGE
           FROM PATIENTS WHERE PATIENT_ID = :id`,
          { id: patientId },
          { outFormat: oracledb.OUT_FORMAT_OBJECT },
        );
        const patient = patientResult.rows?.[0];

        if (patient) {
          const mortuaryResult = await c.execute(
            `SELECT RECORD_ID FROM MORTUARY_RECORDS
             WHERE UPPER(TRIM(PATIENT_NAME)) = UPPER(TRIM(:patient_name))
             FETCH FIRST 1 ROWS ONLY`,
            { patient_name: patient.PET_NAME },
            { outFormat: oracledb.OUT_FORMAT_OBJECT },
          );
          if (!mortuaryResult.rows?.length) {
            await c.execute(
              `INSERT INTO MORTUARY_RECORDS (
                 PATIENT_NAME, OWNER_NAME, SPECIES, BREED, AGE, ENTRY_DATE,
                 CAUSE_OF_DEATH, DISPOSITION, STATUS, STORAGE_LOCATION,
                 PICKUP_DATE, NOTES
               ) VALUES (
                 :patient_name, :owner_name, :species, :breed, :age,
                 TO_CHAR(SYSDATE, 'YYYY-MM-DD'), 'Marked Deceased in Patient Records',
                 'Pending', 'pending', 'N/A', 'Pending',
                 'Created automatically when patient was marked deceased.'
               )`,
              {
                patient_name: patient.PET_NAME,
                owner_name: patient.OWNER_NAME,
                species: patient.PET_SPECIES,
                breed: patient.PET_BREED,
                age: patient.PET_AGE,
              },
              { autoCommit: false },
            );
          }

          const invoiceResult = await c.execute(
            `SELECT BILLING_ID FROM BILLING
             WHERE PATIENT_ID = :patient_id
               AND LOWER(DESCRIPTION) LIKE 'mortuary care -%'
             FETCH FIRST 1 ROWS ONLY`,
            { patient_id: patientId },
            { outFormat: oracledb.OUT_FORMAT_OBJECT },
          );
          if (!invoiceResult.rows?.length) {
            await c.execute(
              `INSERT INTO BILLING (
                 PATIENT_ID, AMOUNT, STATUS, DESCRIPTION, PAYMENT_METHOD, ISSUED_AT
               ) VALUES (
                 :patient_id, 250, 'Pending', :description, 'Pending', SYSTIMESTAMP
               )`,
              {
                patient_id: patientId,
                description: `Mortuary Care - ${patient.PET_NAME} (${patient.PET_SPECIES || "Pet"})`,
              },
              { autoCommit: false },
            );
          }
        }
      }

      await c.commit();
      return result;
    } catch (error) {
      await c.rollback();
      throw error;
    }
  });
}

async function clearPatientStatus(id) {
  return withConnection((c) =>
    c.execute(
      `UPDATE PATIENTS SET PATIENT_STATUS = 'Active' WHERE PATIENT_ID = :id`,
      { id: Number(id) },
      { autoCommit: true },
    ),
  );
}

async function remove(id) {
  return withConnection((c) =>
    c.execute("DELETE FROM PATIENTS WHERE PATIENT_ID = :id", { id: Number(id) }, { autoCommit: true }),
  );
}

async function getAppointments(patientId) {
  return withConnection(async (c) => {
    const res = await c.execute(
      `SELECT a.*, u.FULL_NAME AS VET_NAME
       FROM APPOINTMENTS a
       LEFT JOIN USERS u ON u.USER_ID = a.VETERINARIAN_ID
       WHERE a.PATIENT_ID = :patientId
          OR (a.PATIENT_ID IS NULL 
              AND UPPER(TRIM(a.PET_NAME)) = (SELECT UPPER(TRIM(PET_NAME)) FROM PATIENTS WHERE PATIENT_ID = :pId2)
              AND UPPER(TRIM(a.OWNER_NAME)) = (SELECT UPPER(TRIM(OWNER_NAME)) FROM PATIENTS WHERE PATIENT_ID = :pId3))
       ORDER BY a.APPOINTMENT_ID DESC`,
      { patientId: Number(patientId), pId2: Number(patientId), pId3: Number(patientId) },
      { outFormat: oracledb.OUT_FORMAT_OBJECT },
    );
    return res.rows || [];
  });
}

// ==========================================
// WEIGHT TRACKING
// ==========================================
async function getWeights(patientId) {
  return withConnection(async (c) => {
    const res = await c.execute(
      `SELECT WEIGHT_ID, PATIENT_ID, WEIGHT_KG, 
              TO_CHAR(RECORDED_DATE, 'YYYY-MM-DD') AS RECORDED_DATE,
              NOTES, CREATED_AT
       FROM PATIENT_WEIGHTS
       WHERE PATIENT_ID = :patientId
       ORDER BY RECORDED_DATE ASC, WEIGHT_ID ASC`,
      { patientId: Number(patientId) },
      { outFormat: oracledb.OUT_FORMAT_OBJECT },
    );
    return res.rows || [];
  });
}

async function addWeight(patientId, data) {
  return withConnection(async (c) => {
    const dateVal = data.recorded_date || new Date().toISOString().split("T")[0];
    const res = await c.execute(
      `INSERT INTO PATIENT_WEIGHTS (PATIENT_ID, WEIGHT_KG, RECORDED_DATE, NOTES)
       VALUES (:patientId, :weight_kg, TO_DATE(:recorded_date, 'YYYY-MM-DD'), :notes)
       RETURNING WEIGHT_ID INTO :weight_id`,
      {
        patientId: Number(patientId),
        weight_kg: Number(data.weight_kg),
        recorded_date: dateVal,
        notes: data.notes || null,
        weight_id: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT },
      },
      { autoCommit: true },
    );
    return res.outBinds.weight_id[0];
  });
}

async function deleteWeight(patientId, weightId) {
  return withConnection((c) =>
    c.execute(
      `DELETE FROM PATIENT_WEIGHTS WHERE PATIENT_ID = :patientId AND WEIGHT_ID = :weightId`,
      { patientId: Number(patientId), weightId: Number(weightId) },
      { autoCommit: true },
    ),
  );
}

// ==========================================
// MEDICAL NOTES
// ==========================================
async function getNotes(patientId) {
  return withConnection(async (c) => {
    const res = await c.execute(
      `SELECT NOTE_ID, PATIENT_ID, NOTE_TEXT, IS_WARNING, DOCTOR_NAME,
              CREATED_AT,
              TO_CHAR(CREATED_AT, 'Mon DD, YYYY, HH:MI AM') AS FORMATTED_DATE
       FROM PATIENT_MEDICAL_NOTES
       WHERE PATIENT_ID = :patientId
       ORDER BY CREATED_AT DESC, NOTE_ID DESC`,
      { patientId: Number(patientId) },
      { outFormat: oracledb.OUT_FORMAT_OBJECT },
    );
    return res.rows || [];
  });
}

async function createNote(patientId, data) {
  return withConnection(async (c) => {
    const res = await c.execute(
      `INSERT INTO PATIENT_MEDICAL_NOTES (PATIENT_ID, NOTE_TEXT, IS_WARNING, DOCTOR_NAME)
       VALUES (:patientId, :note_text, :is_warning, :doctor_name)
       RETURNING NOTE_ID INTO :note_id`,
      {
        patientId: Number(patientId),
        note_text: data.note_text || data.text || "",
        is_warning: data.is_warning ? 1 : 0,
        doctor_name: data.doctor_name || "Veterinarian",
        note_id: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT },
      },
      { autoCommit: true },
    );
    return res.outBinds.note_id[0];
  });
}

async function updateNote(patientId, noteId, data) {
  return withConnection((c) =>
    c.execute(
      `UPDATE PATIENT_MEDICAL_NOTES 
       SET NOTE_TEXT = :note_text, IS_WARNING = :is_warning
       WHERE PATIENT_ID = :patientId AND NOTE_ID = :noteId`,
      {
        patientId: Number(patientId),
        noteId: Number(noteId),
        note_text: data.note_text || data.text,
        is_warning: data.is_warning ? 1 : 0,
      },
      { autoCommit: true },
    ),
  );
}

async function deleteNote(patientId, noteId) {
  return withConnection((c) =>
    c.execute(
      `DELETE FROM PATIENT_MEDICAL_NOTES WHERE PATIENT_ID = :patientId AND NOTE_ID = :noteId`,
      { patientId: Number(patientId), noteId: Number(noteId) },
      { autoCommit: true },
    ),
  );
}

// ==========================================
// LAB FILES
// ==========================================
async function getLabFiles(patientId) {
  return withConnection(async (c) => {
    const res = await c.execute(
      `SELECT FILE_ID as "id", FILE_NAME as "name", FILE_TYPE as "type", 
              FILE_SIZE as "size", FILE_DATA as "dataUrl",
              TO_CHAR(UPLOADED_AT, 'Mon DD, YYYY') AS "uploadedAt"
       FROM PATIENT_LAB_FILES
       WHERE PATIENT_ID = :patientId
       ORDER BY UPLOADED_AT DESC`,
      { patientId: Number(patientId) },
      { outFormat: oracledb.OUT_FORMAT_OBJECT },
    );
    return res.rows || [];
  });
}

async function addLabFile(patientId, file) {
  return withConnection(async (c) => {
    const res = await c.execute(
      `INSERT INTO PATIENT_LAB_FILES (PATIENT_ID, FILE_NAME, FILE_TYPE, FILE_SIZE, FILE_DATA)
       VALUES (:patientId, :fileName, :fileType, :fileSize, :fileData)
       RETURNING FILE_ID INTO :fileId`,
      {
        patientId: Number(patientId),
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        fileData: file.dataUrl,
        fileId: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT },
      },
      { autoCommit: true },
    );
    return res.outBinds.fileId[0];
  });
}

async function deleteLabFile(patientId, fileId) {
  return withConnection((c) =>
    c.execute(
      `DELETE FROM PATIENT_LAB_FILES WHERE PATIENT_ID = :patientId AND FILE_ID = :fileId`,
      { patientId: Number(patientId), fileId: Number(fileId) },
      { autoCommit: true },
    ),
  );
}

module.exports = {
  list,
  findById,
  create,
  update,
  remove,
  getAppointments,
  getWeights,
  addWeight,
  deleteWeight,
  getNotes,
  createNote,
  updateNote,
  deleteNote,
  getLabFiles,
  addLabFile,
  deleteLabFile,
  updateVaccinationStatus,
  updatePatientStatus,
  clearPatientStatus,
};
