const oracledb = require("oracledb");
try {
  oracledb.fetchAsString = [oracledb.CLOB];
} catch (e) {}
const { withConnection } = require("../config/database");

async function list() {
  return withConnection((c) =>
    c
      .execute(
        "SELECT STAFF_ID, USER_ID, STAFF_NUMBER, FULL_NAME, DEPARTMENT, JOB_TITLE, PHONE, EMAIL, NVL(STATUS, 'Active') AS STATUS, SALARY, CREATED_AT FROM STAFF ORDER BY STAFF_ID DESC",
        [],
        { outFormat: oracledb.OUT_FORMAT_OBJECT },
      )
      .then((r) => r.rows || []),
  );
}

async function create(data) {
  return withConnection((c) =>
    c.execute(
      `INSERT INTO STAFF (FULL_NAME, STAFF_NUMBER, DEPARTMENT, JOB_TITLE, PHONE, EMAIL, STATUS, SALARY, CREATED_AT)
       VALUES (:full_name, :staff_number, :department, :job_title, :phone, :email, NVL(:status, 'Active'), :salary, SYSTIMESTAMP)`,
      {
        full_name: data.full_name || data.name || "Staff Member",
        staff_number: data.staff_number || `STF-${Math.floor(100 + Math.random() * 900)}`,
        department: data.department || data.specialty || "Clinical Operations",
        job_title: data.job_title || data.role || "Veterinarian",
        phone: data.phone || "",
        email: data.email || "",
        status: data.status || "Active",
        salary: Number(data.salary || 6000),
      },
      { autoCommit: true },
    ),
  );
}

async function update(id, data) {
  return withConnection((c) =>
    c.execute(
      `UPDATE STAFF 
       SET FULL_NAME = :full_name, DEPARTMENT = :department, JOB_TITLE = :job_title, 
           PHONE = :phone, EMAIL = :email, STATUS = :status 
       WHERE STAFF_ID = :id`,
      {
        id,
        full_name: data.full_name || data.name,
        department: data.department || data.specialty,
        job_title: data.job_title || data.role,
        phone: data.phone || "",
        email: data.email || "",
        status: data.status || "Active",
      },
      { autoCommit: true },
    ),
  );
}

async function remove(id) {
  return withConnection((c) =>
    c.execute("DELETE FROM STAFF WHERE STAFF_ID = :id", { id }, { autoCommit: true }),
  );
}

module.exports = { list, create, update, remove };
