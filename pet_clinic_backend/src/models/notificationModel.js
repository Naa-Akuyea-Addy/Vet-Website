const oracledb = require("oracledb");
const { withConnection } = require("../config/database");

async function ensureWelcomeNotification(userId) {
  return withConnection((connection) => connection.execute(
    `INSERT INTO USER_NOTIFICATIONS (USER_ID, TITLE, MESSAGE, TYPE)
     SELECT :userId, 'Welcome to addyPets', 'Your personal notifications appear here.', 'info' FROM DUAL
     WHERE NOT EXISTS (SELECT 1 FROM USER_NOTIFICATIONS WHERE USER_ID = :userId)`,
    { userId }, { autoCommit: true },
  ));
}

async function listForUser(userId) {
  return withConnection(async (connection) => {
    await ensureWelcomeNotification(userId);
    const result = await connection.execute(
      `SELECT NOTIFICATION_ID, TITLE, MESSAGE, TYPE, IS_READ, CREATED_AT
       FROM USER_NOTIFICATIONS WHERE USER_ID = :userId
       ORDER BY CREATED_AT DESC FETCH FIRST 30 ROWS ONLY`,
      { userId }, { outFormat: oracledb.OUT_FORMAT_OBJECT },
    );
    return result.rows || [];
  });
}

async function markRead(userId, notificationId) {
  return withConnection((connection) => connection.execute(
    "UPDATE USER_NOTIFICATIONS SET IS_READ = 'Y' WHERE NOTIFICATION_ID = :notificationId AND USER_ID = :userId",
    { userId, notificationId }, { autoCommit: true },
  ));
}

async function markAllRead(userId) {
  return withConnection((connection) => connection.execute(
    "UPDATE USER_NOTIFICATIONS SET IS_READ = 'Y' WHERE USER_ID = :userId AND IS_READ = 'N'",
    { userId }, { autoCommit: true },
  ));
}

module.exports = { listForUser, markRead, markAllRead };
