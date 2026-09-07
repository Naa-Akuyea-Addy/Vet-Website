const oracledb = require("oracledb");
try {
  oracledb.fetchAsString = [oracledb.CLOB];
} catch (e) {}
const { withConnection } = require("../config/database");

async function list() {
  return withConnection((c) =>
    c
      .execute(
        "SELECT PATIENT_ID, PATIENT_NUMBER, PET_NAME, PET_SPECIES, PET_BREED, PET_AGE, SEX, OWNER_NAME, OWNER_PHONE, OWNER_EMAIL, MEDICAL_NOTES, CREATED_AT FROM PATIENTS ORDER BY PATIENT_ID DESC",
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
        "SELECT * FROM PATIENTS WHERE PATIENT_ID = :id",
        { id },
        { outFormat: oracledb.OUT_FORMAT_OBJECT },
      )
      .then((r) => (r.rows && r.rows[0]) || null),
  );
}

async function create(data) {
  return withConnection((c) =>
    c.execute(
      `INSERT INTO PATIENTS (PET_NAME, PET_SPECIES, PET_BREED, PET_AGE, SEX, OWNER_NAME, OWNER_PHONE, OWNER_EMAIL, MEDICAL_NOTES)
       VALUES (:pet_name, :pet_species, :pet_breed, :pet_age, :sex, :owner_name, :owner_phone, :owner_email, :medical_notes)`,
      {
        pet_name: data.pet_name || data.name || "Pet",
        pet_species: data.pet_species || data.species || "Dog",
        pet_breed: data.pet_breed || data.breed || "Mixed Breed",
        pet_age: data.pet_age || data.age || "1 year",
        sex: data.sex || "Male",
        owner_name: data.owner_name || data.owner || "Owner",
        owner_phone: data.owner_phone || data.phone || "",
        owner_email: data.owner_email || data.email || "",
        medical_notes: data.medical_notes || data.notes || "",
      },
      { autoCommit: true },
    ),
  );
}

async function update(id, data) {
  return withConnection((c) =>
    c.execute(
      `UPDATE PATIENTS 
       SET PET_NAME = :pet_name, PET_SPECIES = :pet_species, PET_BREED = :pet_breed, PET_AGE = :pet_age, 
           SEX = :sex, OWNER_NAME = :owner_name, OWNER_PHONE = :owner_phone, OWNER_EMAIL = :owner_email, 
           MEDICAL_NOTES = :medical_notes
       WHERE PATIENT_ID = :id`,
      {
        id,
        pet_name: data.pet_name || data.name,
        pet_species: data.pet_species || data.species,
        pet_breed: data.pet_breed || data.breed,
        pet_age: data.pet_age || data.age,
        sex: data.sex || "Male",
        owner_name: data.owner_name || data.owner,
        owner_phone: data.owner_phone || data.phone,
        owner_email: data.owner_email || data.email,
        medical_notes: data.medical_notes || data.notes,
      },
      { autoCommit: true },
    ),
  );
}

async function remove(id) {
  return withConnection((c) =>
    c.execute("DELETE FROM PATIENTS WHERE PATIENT_ID = :id", { id }, { autoCommit: true }),
  );
}

module.exports = { list, findById, create, update, remove };
