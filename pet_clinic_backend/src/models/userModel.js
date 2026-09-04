const oracledb = require("oracledb");
try {
  oracledb.fetchAsString = [oracledb.CLOB];
} catch (e) {}
const bcrypt = require("bcryptjs");
const { withConnection } = require("../config/database");

async function findByEmail(email) {
  return withConnection(async (connection) => {
    const result = await connection.execute(
      "SELECT USER_ID, EMAIL, PASSWORD_HASH, FULL_NAME, ROLE, PHONE, LICENSE_NUMBER, PROFILE_IMAGE, NVL(STATUS, 'Active') AS STATUS FROM USERS WHERE LOWER(EMAIL) = LOWER(:email)",
      { email: (email || "").trim() },
      { outFormat: oracledb.OUT_FORMAT_OBJECT },
    );
    return result.rows[0] || null;
  });
}

async function findPublicById(userId) {
  return withConnection(async (connection) => {
    const result = await connection.execute(
      "SELECT USER_ID, EMAIL, FULL_NAME, ROLE, PHONE, PROFILE_IMAGE, NVL(STATUS, 'Active') AS STATUS FROM USERS WHERE USER_ID = :userId",
      { userId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT },
    );
    return result.rows[0] || null;
  });
}

async function savePasswordResetToken(email, tokenHash) {
  return withConnection((connection) =>
    connection.execute(
      `UPDATE USERS
       SET PASSWORD_RESET_TOKEN_HASH = :tokenHash,
           PASSWORD_RESET_EXPIRES_AT = SYSTIMESTAMP + INTERVAL '30' MINUTE
       WHERE LOWER(EMAIL) = LOWER(:email)`,
      { email: (email || "").trim(), tokenHash },
      { autoCommit: true },
    ),
  );
}

async function resetPassword(tokenHash, passwordHash) {
  return withConnection((connection) =>
    connection.execute(
      `UPDATE USERS
       SET PASSWORD_HASH = :passwordHash,
           PASSWORD_RESET_TOKEN_HASH = NULL,
           PASSWORD_RESET_EXPIRES_AT = NULL,
           UPDATED_AT = SYSTIMESTAMP
       WHERE PASSWORD_RESET_TOKEN_HASH = :tokenHash
         AND PASSWORD_RESET_EXPIRES_AT > SYSTIMESTAMP`,
      { tokenHash, passwordHash },
      { autoCommit: true },
    ),
  );
}

async function updateProfileImage(userId, profileImage) {
  return withConnection((connection) => connection.execute(
    "UPDATE USERS SET PROFILE_IMAGE = :profileImage, UPDATED_AT = SYSTIMESTAMP WHERE USER_ID = :userId",
    { userId, profileImage }, { autoCommit: true },
  ));
}

async function updatePasswordHash(userId, passwordHash) {
  return withConnection((connection) => connection.execute(
    "UPDATE USERS SET PASSWORD_HASH = :passwordHash, UPDATED_AT = SYSTIMESTAMP WHERE USER_ID = :userId",
    { userId, passwordHash }, { autoCommit: true },
  ));
}

async function list() {
  return withConnection((connection) =>
    connection
      .execute(
        "SELECT USER_ID, EMAIL, FULL_NAME, ROLE, PHONE, LICENSE_NUMBER, NVL(STATUS, 'Active') AS STATUS, CREATED_AT, LAST_LOGIN FROM USERS ORDER BY USER_ID DESC",
        [],
        { outFormat: oracledb.OUT_FORMAT_OBJECT },
      )
      .then((result) => result.rows || []),
  );
}

async function create(userData) {
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(userData.password || "Password123!", salt);
  const role = userData.role || "Veterinarian";
  const status = userData.status || "Active";

  return withConnection(async (connection) => {
    // 1. Insert into USERS table
    const userRes = await connection.execute(
      `INSERT INTO USERS (EMAIL, PASSWORD_HASH, FULL_NAME, ROLE, LICENSE_NUMBER, PHONE, STATUS, CREATED_AT)
       VALUES (:email, :passwordHash, :fullName, :role, :licenseNumber, :phone, :status, SYSTIMESTAMP)
       RETURNING USER_ID INTO :userId`,
      {
        email: (userData.email || "").trim(),
        passwordHash,
        fullName: userData.fullName || userData.full_name || userData.name || "Clinic Staff",
        role,
        licenseNumber: userData.licenseNumber || userData.license_number || "",
        phone: userData.phone || "",
        status,
        userId: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
      },
      { autoCommit: true },
    );
    const userId = userRes.outBinds?.userId?.[0] || null;

    // 2. Also ensure staff member is recorded in STAFF table if not already present
    try {
      await connection.execute(
        `INSERT INTO STAFF (USER_ID, FULL_NAME, JOB_TITLE, DEPARTMENT, EMAIL, PHONE, STATUS)
         SELECT :userId, :fullName, :jobTitle, :department, :email, :phone, :status FROM DUAL
         WHERE NOT EXISTS (SELECT 1 FROM STAFF WHERE LOWER(EMAIL) = LOWER(:email))`,
        {
          userId,
          fullName: userData.fullName || userData.full_name || userData.name || "Clinic Staff",
          jobTitle: role,
          department: userData.department || "Clinical Operations",
          email: (userData.email || "").trim(),
          phone: userData.phone || "",
          status,
        },
        { autoCommit: true },
      );
    } catch (e) {
      console.warn("Staff mirror insert skipped:", e.message);
    }

    return userRes;
  });
}

async function updateRole(id, role) {
  return withConnection((connection) =>
    connection.execute(
      "UPDATE USERS SET ROLE = :role, UPDATED_AT = SYSTIMESTAMP WHERE USER_ID = :id",
      { id, role },
      { autoCommit: true },
    ),
  );
}

async function updateStatus(id, status) {
  return withConnection((connection) =>
    connection.execute(
      "UPDATE USERS SET STATUS = :status, UPDATED_AT = SYSTIMESTAMP WHERE USER_ID = :id",
      { id, status },
      { autoCommit: true },
    ),
  );
}

async function remove(id) {
  return withConnection((connection) =>
    connection.execute(
      "DELETE FROM USERS WHERE USER_ID = :id",
      { id },
      { autoCommit: true },
    ),
  );
}

module.exports = {
  findByEmail,
  findPublicById,
  savePasswordResetToken,
  resetPassword,
  updateProfileImage,
  updatePasswordHash,
  list,
  create,
  updateRole,
  updateStatus,
  remove,
};
