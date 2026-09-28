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

// Enriched list: JOINs PATIENTS for breed/sex/email, and BOOKINGS for booking channel
async function listWithBookings() {
  try {
    return await withConnection((c) =>
      c
        .execute(
          `SELECT a.*,
                  u.FULL_NAME AS VET_NAME,
                  p.PET_BREED, p.SEX, p.OWNER_EMAIL,
                  p.MEDICAL_NOTES AS PATIENT_NOTES,
                  p.PATIENT_NUMBER,
                  b.BOOKING_ID, b.BOOKING_SOURCE, b.BOOKING_REFERENCE
           FROM ${table} a
           LEFT JOIN USERS u ON u.USER_ID = a.VETERINARIAN_ID
           LEFT JOIN PATIENTS p ON p.PATIENT_ID = a.PATIENT_ID
           LEFT JOIN BOOKINGS b ON b.APPOINTMENT_ID = a.APPOINTMENT_ID
           ORDER BY a.APPOINTMENT_ID DESC`,
          [],
          { outFormat: oracledb.OUT_FORMAT_OBJECT },
        )
        .then((r) => r.rows || []),
    );
  } catch (err) {
    // BOOKINGS table may not exist yet — fall back to plain list
    if (err.errorNum === 942 || (err.message || "").includes("table or view does not exist")) {
      console.warn("BOOKINGS table missing – run migrate_bookings.sql. Falling back to plain list.");
      return list();
    }
    throw err;
  }
}


async function findById(id) {
  return withConnection((c) =>
    c
      .execute(
        `SELECT a.*,
                u.FULL_NAME AS VET_NAME,
                p.PET_BREED, p.SEX, p.OWNER_EMAIL,
                p.PATIENT_NUMBER,
                b.BOOKING_ID, b.BOOKING_SOURCE, b.BOOKING_REFERENCE
         FROM ${table} a
         LEFT JOIN USERS u ON u.USER_ID = a.VETERINARIAN_ID
         LEFT JOIN PATIENTS p ON p.PATIENT_ID = a.PATIENT_ID
         LEFT JOIN BOOKINGS b ON b.APPOINTMENT_ID = a.APPOINTMENT_ID
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
       JOIN USERS u ON s.USER_ID = u.USER_ID
       LEFT JOIN APPOINTMENTS a
         ON a.VETERINARIAN_ID = u.USER_ID
        AND a.STATUS IN ('Pending', 'Confirmed')
       WHERE LOWER(NVL(u.STATUS, 'Active')) = 'active'
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
  const ownerPhone = (data.owner_phone || data.phone || "").toString().trim();
  const cleanPhone = ownerPhone.replace(/[^0-9]/g, "");

  // 1. Try matching pet name + owner name + phone digits (if clean phone provided)
  let existing = null;
  if (cleanPhone) {
    existing = await connection.execute(
      `SELECT PATIENT_ID, OWNER_PHONE
       FROM PATIENTS
       WHERE UPPER(TRIM(PET_NAME)) = UPPER(TRIM(:pet_name))
         AND UPPER(TRIM(OWNER_NAME)) = UPPER(TRIM(:owner_name))
         AND NVL(REGEXP_REPLACE(OWNER_PHONE, '[^0-9]', ''), '') = :clean_phone
       ORDER BY PATIENT_ID DESC
       FETCH FIRST 1 ROWS ONLY`,
      { pet_name: petName, owner_name: ownerName, clean_phone: cleanPhone },
      { outFormat: oracledb.OUT_FORMAT_OBJECT },
    );
  }

  // 2. Fallback: match by pet name and owner name (handles cases where phone was not stored or differs in formatting)
  if (!existing?.rows?.[0]?.PATIENT_ID) {
    existing = await connection.execute(
      `SELECT PATIENT_ID, OWNER_PHONE
       FROM PATIENTS
       WHERE UPPER(TRIM(PET_NAME)) = UPPER(TRIM(:pet_name))
         AND UPPER(TRIM(OWNER_NAME)) = UPPER(TRIM(:owner_name))
       ORDER BY PATIENT_ID DESC
       FETCH FIRST 1 ROWS ONLY`,
      { pet_name: petName, owner_name: ownerName },
      { outFormat: oracledb.OUT_FORMAT_OBJECT },
    );
  }

  if (existing?.rows?.[0]?.PATIENT_ID) {
    const matchedId = existing.rows[0].PATIENT_ID;
    const currentPhone = (existing.rows[0].OWNER_PHONE || "").toString().trim();
    // Backfill phone if the existing record was missing a phone number
    if (!currentPhone && ownerPhone) {
      await connection.execute(
        `UPDATE PATIENTS SET OWNER_PHONE = :owner_phone WHERE PATIENT_ID = :id`,
        { owner_phone: ownerPhone, id: matchedId },
      );
    }
    return matchedId;
  }

  // Normalize age
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

  const created = await connection.execute(
    `INSERT INTO PATIENTS (PET_NAME, PET_SPECIES, PET_AGE, PET_AGE_VALUE, PET_AGE_UNIT, OWNER_NAME, OWNER_PHONE)
     VALUES (:pet_name, :pet_species, :pet_age, :pet_age_value, :pet_age_unit, :owner_name, :owner_phone)
     RETURNING PATIENT_ID INTO :patient_id`,
    {
      pet_name: petName,
      pet_species: data.pet_species || "Dog",
      pet_age: formattedAge || "1 year",
      pet_age_value: ageValue !== null ? ageValue : 1,
      pet_age_unit: ageUnit,
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
      `INSERT INTO ${table} (PATIENT_ID, PET_NAME, PET_SPECIES, PET_AGE, PET_AGE_VALUE, PET_AGE_UNIT, OWNER_NAME, OWNER_PHONE, VISIT_REASON, SERVICE, APPOINTMENT_TIME, STATUS, NOTES, VETERINARIAN_ID)
       VALUES (:patient_id, :pet_name, :pet_species, :pet_age, :pet_age_value, :pet_age_unit, :owner_name, :owner_phone, :visit_reason, :service,
               :appointment_time, NVL(:status, 'Pending'), :notes, :veterinarian_id)
       RETURNING APPOINTMENT_ID INTO :appointment_id`,
      {
        patient_id: patientId,
        pet_name: data.pet_name || data.patient || 'Pet',
        pet_species: data.pet_species || 'Dog',
        pet_age: formattedAge || '1 year',
        pet_age_value: ageValue !== null ? ageValue : 1,
        pet_age_unit: ageUnit,
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
  return withConnection(async (c) => {
    const petName = data.pet_name || data.petName || data.patient || null;
    const petSpecies = data.pet_species || data.petSpecies || data.petType || null;
    
    let petAge = data.pet_age || data.petAge || null;
    let petAgeVal = data.pet_age_value !== undefined && data.pet_age_value !== null ? Number(data.pet_age_value) : null;
    let petAgeUnit = data.pet_age_unit || null;
    if (petAgeVal === null && petAge) {
      const match = String(petAge).match(/\d+/);
      if (match) petAgeVal = parseInt(match[0], 10);
      if (String(petAge).toLowerCase().includes("month")) petAgeUnit = "months";
      else if (String(petAge).toLowerCase().includes("week")) petAgeUnit = "weeks";
      else petAgeUnit = "years";
    }
    if (!petAge && petAgeVal !== null) {
      petAge = `${petAgeVal} ${petAgeUnit || 'years'}`;
    }

    const ownerName = data.owner_name || data.ownerName || data.owner || null;
    const ownerPhone = data.owner_phone || data.ownerPhone || data.phoneNumber || data.phone || null;
    const visitReason = data.visit_reason || data.visitReason || data.service || data.serviceType || data.type || null;
    const service = data.service || data.serviceType || data.visit_reason || data.type || null;
    const appointmentTime = data.appointment_time || data.appointmentTime || (data.date ? `${data.date} ${data.time || ''}`.trim() : null);
    const status = data.status || null;
    const notes = data.notes !== undefined ? data.notes : null;
    const vetId = data.veterinarian_id !== undefined ? (isNaN(Number(data.veterinarian_id)) ? null : Number(data.veterinarian_id)) : (data.doctorName && !isNaN(Number(data.doctorName)) ? Number(data.doctorName) : null);
    const patientId = data.patient_id ? Number(data.patient_id) : null;

    const result = await c.execute(
      `UPDATE ${table}
       SET PET_NAME = NVL(:pet_name, PET_NAME),
           PATIENT_ID = NVL(:patient_id, PATIENT_ID),
           PET_SPECIES = NVL(:pet_species, PET_SPECIES),
           PET_AGE = NVL(:pet_age, PET_AGE),
           PET_AGE_VALUE = NVL(:pet_age_value, PET_AGE_VALUE),
           PET_AGE_UNIT = NVL(:pet_age_unit, PET_AGE_UNIT),
           OWNER_NAME = NVL(:owner_name, OWNER_NAME),
           OWNER_PHONE = NVL(:owner_phone, OWNER_PHONE),
           VISIT_REASON = NVL(:visit_reason, VISIT_REASON),
           SERVICE = NVL(:service, SERVICE),
           APPOINTMENT_TIME = NVL(:appointment_time, APPOINTMENT_TIME),
           STATUS = NVL(:status, STATUS),
           NOTES = NVL(:notes, NOTES),
           VETERINARIAN_ID = NVL(:veterinarian_id, VETERINARIAN_ID)
       WHERE APPOINTMENT_ID = :id`,
      {
        id,
        patient_id: patientId,
        pet_name: petName,
        pet_species: petSpecies,
        pet_age: petAge,
        pet_age_value: petAgeVal,
        pet_age_unit: petAgeUnit,
        owner_name: ownerName,
        owner_phone: ownerPhone,
        visit_reason: visitReason,
        service: service,
        appointment_time: appointmentTime,
        status: status,
        notes: notes,
        veterinarian_id: vetId,
      },
      { autoCommit: true },
    );

    // Sync back to PATIENTS table if linked
    if (petName || petSpecies || ownerName || ownerPhone || petAge || petAgeVal !== null) {
      await c.execute(
        `UPDATE PATIENTS p
         SET PET_NAME = NVL(:pet_name, PET_NAME),
             PET_SPECIES = NVL(:pet_species, PET_SPECIES),
             PET_AGE = NVL(:pet_age, PET_AGE),
             PET_AGE_VALUE = NVL(:pet_age_value, PET_AGE_VALUE),
             PET_AGE_UNIT = NVL(:pet_age_unit, PET_AGE_UNIT),
             OWNER_NAME = NVL(:owner_name, OWNER_NAME),
             OWNER_PHONE = NVL(:owner_phone, OWNER_PHONE)
         WHERE p.PATIENT_ID = (SELECT a.PATIENT_ID FROM APPOINTMENTS a WHERE a.APPOINTMENT_ID = :id AND a.PATIENT_ID IS NOT NULL)`,
        {
          id,
          pet_name: petName,
          pet_species: petSpecies,
          pet_age: petAge,
          pet_age_value: petAgeVal,
          pet_age_unit: petAgeUnit,
          owner_name: ownerName,
          owner_phone: ownerPhone,
        },
        { autoCommit: true },
      );
    }

    return result;
  });
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

module.exports = { list, listWithBookings, create, updateStatus, update, remove, purgeExpired };
