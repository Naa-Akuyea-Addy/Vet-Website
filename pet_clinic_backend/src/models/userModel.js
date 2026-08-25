const { withConnection } = require("../config/database");

async function findByEmail(email) {
  return withConnection(async (connection) => {
    const result = await connection.execute(
      "SELECT USER_ID, EMAIL, PASSWORD_HASH, FULL_NAME, ROLE FROM USERS WHERE EMAIL = :email",
      { email },
      { outFormat: objectFormat() },
    );
    return result.rows[0] || null;
  });
}

function objectFormat() {
  const oracledb = require("oracledb");
  return oracledb.OUT_FORMAT_OBJECT;
}

async function create(user) {
  return withConnection((connection) =>
    connection.execute(
      `INSERT INTO USERS (EMAIL, PASSWORD_HASH, FULL_NAME, LICENSE_NUMBER, PHONE)
     VALUES (:email, :passwordHash, :fullName, :licenseNumber, :phone)`,
      user,
      { autoCommit: true },
    ),
  );
}

module.exports = { findByEmail, create };
