const oracledb = require("oracledb");
try {
  oracledb.fetchAsString = [oracledb.CLOB];
} catch (e) {}
const { withConnection } = require("../config/database");

async function list() {
  return withConnection((c) =>
    c
      .execute(
        `SELECT NVL(s.STAFF_ID, u.USER_ID) AS STAFF_ID,
                u.USER_ID,
                NVL(s.STAFF_NUMBER, NVL(s.LICENSE_NUMBER, 'STF-' || LPAD(u.USER_ID, 3, '0'))) AS STAFF_NUMBER,
                NVL(s.LICENSE_NUMBER, 'LIC-' || LPAD(u.USER_ID, 4, '0')) AS LICENSE_NUMBER,
                NVL(s.DEPARTMENT, CASE 
                  WHEN u.ROLE = 'Super Admin' THEN 'Executive Administration'
                  WHEN u.ROLE = 'Admin' THEN 'Clinic Administration'
                  WHEN u.ROLE = 'Veterinarian' THEN 'General Medicine'
                  WHEN u.ROLE = 'Accountant' THEN 'Billing & Accounts'
                  WHEN u.ROLE = 'InventoryManager' THEN 'Pharmacy & Inventory'
                  WHEN u.ROLE = 'Receptionist' THEN 'Front Desk'
                  WHEN u.ROLE = 'Technician' THEN 'Diagnostics & Records'
                  ELSE 'Clinical Operations'
                END) AS DEPARTMENT,
                NVL(s.JOB_TITLE, u.ROLE) AS JOB_TITLE,
                NVL(s.SALARY, 6000) AS SALARY,
                NVL(s.CREATED_AT, u.CREATED_AT) AS CREATED_AT,
                u.FULL_NAME, u.PHONE, u.EMAIL, u.ROLE,
                NVL(TRIM(u.STATUS), 'Active') AS STATUS,
                u.PROFILE_IMAGE, u.LAST_LOGIN
         FROM USERS u
         LEFT JOIN STAFF s ON s.USER_ID = u.USER_ID
         WHERE u.ROLE IS NOT NULL
         ORDER BY u.USER_ID DESC`,
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
        `SELECT NVL(s.STAFF_ID, u.USER_ID) AS STAFF_ID,
                u.USER_ID,
                NVL(s.STAFF_NUMBER, NVL(s.LICENSE_NUMBER, 'STF-' || LPAD(u.USER_ID, 3, '0'))) AS STAFF_NUMBER,
                s.LICENSE_NUMBER,
                NVL(s.DEPARTMENT, 'Clinical Operations') AS DEPARTMENT,
                NVL(s.JOB_TITLE, u.ROLE) AS JOB_TITLE,
                NVL(s.SALARY, 6000) AS SALARY,
                NVL(s.CREATED_AT, u.CREATED_AT) AS CREATED_AT,
                u.FULL_NAME, u.PHONE, u.EMAIL, u.ROLE,
                NVL(TRIM(u.STATUS), 'Active') AS STATUS,
                u.PROFILE_IMAGE, u.LAST_LOGIN
         FROM USERS u
         LEFT JOIN STAFF s ON s.USER_ID = u.USER_ID
         WHERE s.STAFF_ID = :id OR u.USER_ID = :id`,
        { id },
        { outFormat: oracledb.OUT_FORMAT_OBJECT },
      )
      .then((r) => (r.rows && r.rows[0]) || null),
  );
}

async function findByUserId(userId) {
  return withConnection((c) =>
    c
      .execute(
        `SELECT NVL(s.STAFF_ID, u.USER_ID) AS STAFF_ID,
                u.USER_ID,
                NVL(s.STAFF_NUMBER, NVL(s.LICENSE_NUMBER, 'STF-' || LPAD(u.USER_ID, 3, '0'))) AS STAFF_NUMBER,
                s.LICENSE_NUMBER,
                NVL(s.DEPARTMENT, 'Clinical Operations') AS DEPARTMENT,
                NVL(s.JOB_TITLE, u.ROLE) AS JOB_TITLE,
                NVL(s.SALARY, 6000) AS SALARY,
                NVL(s.CREATED_AT, u.CREATED_AT) AS CREATED_AT,
                u.FULL_NAME, u.PHONE, u.EMAIL, u.ROLE,
                NVL(TRIM(u.STATUS), 'Active') AS STATUS
         FROM USERS u
         LEFT JOIN STAFF s ON s.USER_ID = u.USER_ID
         WHERE u.USER_ID = :userId`,
        { userId },
        { outFormat: oracledb.OUT_FORMAT_OBJECT },
      )
      .then((r) => (r.rows && r.rows[0]) || null),
  );
}

async function create(data) {
  return withConnection((c) =>
    c.execute(
      `INSERT INTO STAFF (USER_ID, LICENSE_NUMBER, DEPARTMENT, JOB_TITLE, SALARY, CREATED_AT)
       VALUES (:user_id, :license_number, :department, :job_title, :salary, SYSTIMESTAMP)`,
      {
        user_id: data.user_id || data.userId,
        license_number: data.license_number || data.licenseNumber || "",
        department: data.department || data.specialty || "Clinical Operations",
        job_title: data.job_title || data.jobTitle || data.role || "Veterinarian",
        salary: Number(data.salary || 6000),
      },
      { autoCommit: true },
    ),
  );
}

async function update(id, data) {
  return withConnection(async (c) => {
    // 1. Update work/employment fields in STAFF
    await c.execute(
      `UPDATE STAFF 
       SET LICENSE_NUMBER = NVL(:license_number, LICENSE_NUMBER),
           DEPARTMENT = NVL(:department, DEPARTMENT),
           JOB_TITLE = NVL(:job_title, JOB_TITLE),
           SALARY = NVL(:salary, SALARY)
       WHERE STAFF_ID = :id`,
      {
        id,
        license_number: data.license_number !== undefined ? data.license_number : (data.licenseNumber || null),
        department: data.department !== undefined ? data.department : (data.specialty || null),
        job_title: data.job_title !== undefined ? data.job_title : (data.jobTitle || data.role || null),
        salary: data.salary !== undefined ? Number(data.salary) : null,
      },
      { autoCommit: true },
    );

    // 2. If personal fields are supplied, sync them with the linked user in USERS
    if (data.fullName || data.phone || data.email || data.status) {
      await c.execute(
        `UPDATE USERS u
         SET FULL_NAME = NVL(:fullName, FULL_NAME),
             PHONE = NVL(:phone, PHONE),
             EMAIL = NVL(:email, EMAIL),
             STATUS = NVL(:status, STATUS),
             UPDATED_AT = SYSTIMESTAMP
         WHERE u.USER_ID = (SELECT s.USER_ID FROM STAFF s WHERE s.STAFF_ID = :id)`,
        {
          id,
          fullName: data.fullName || null,
          phone: data.phone || null,
          email: data.email ? data.email.trim() : null,
          status: data.status || null,
        },
        { autoCommit: true },
      );
    }
  });
}

async function remove(id) {
  return withConnection((c) =>
    c.execute("DELETE FROM STAFF WHERE STAFF_ID = :id", { id }, { autoCommit: true }),
  );
}

module.exports = { list, findById, findByUserId, create, update, remove };
