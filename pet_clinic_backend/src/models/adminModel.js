const oracledb = require("oracledb");
const { withConnection } = require("../config/database");

async function listMessages() {
  return withConnection((connection) =>
    connection
      .execute("SELECT * FROM CONTACT_FORM ORDER BY CREATED_AT DESC", [], {
        outFormat: oracledb.OUT_FORMAT_OBJECT,
      })
      .then((result) => result.rows),
  );
}

async function listRoles() {
  return withConnection((connection) =>
    connection
      .execute("SELECT * FROM ROLES ORDER BY ROLE_NAME", [], {
        outFormat: oracledb.OUT_FORMAT_OBJECT,
      })
      .then((result) => result.rows),
  );
}

async function listSettings() {
  return withConnection((connection) =>
    connection
      .execute("SELECT * FROM CLINIC_SETTINGS ORDER BY SETTING_KEY", [], {
        outFormat: oracledb.OUT_FORMAT_OBJECT,
      })
      .then((result) => result.rows),
  );
}

async function listNotifications() {
  return withConnection((connection) =>
    connection
      .execute(
        "SELECT * FROM NOTIFICATION_PREFERENCES ORDER BY NOTIFICATION_KEY",
        [],
        { outFormat: oracledb.OUT_FORMAT_OBJECT },
      )
      .then((result) => result.rows),
  );
}

module.exports = { listMessages, listRoles, listSettings, listNotifications };
