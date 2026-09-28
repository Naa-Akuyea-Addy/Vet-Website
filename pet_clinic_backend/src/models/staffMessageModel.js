const oracledb = require("oracledb");
try {
  oracledb.fetchAsString = [oracledb.CLOB];
} catch (e) {}
const { withConnection } = require("../config/database");

const table = "STAFF_MESSAGES";

async function listBetweenUsers(user1Id, user2Id) {
  return withConnection(async (c) => {
    const sql = user2Id
      ? `SELECT m.MESSAGE_ID, m.SENDER_ID, m.RECEIVER_ID, m.MESSAGE_TEXT,
                m.ATTACHMENT_DATA, m.ATTACHMENT_NAME, m.ATTACHMENT_TYPE, m.ATTACHMENT_SIZE,
                m.IS_READ, m.CREATED_AT,
                s.FULL_NAME AS SENDER_NAME, s.ROLE AS SENDER_ROLE, s.PROFILE_IMAGE AS SENDER_AVATAR,
                r.FULL_NAME AS RECEIVER_NAME
         FROM ${table} m
         JOIN USERS s ON s.USER_ID = m.SENDER_ID
         LEFT JOIN USERS r ON r.USER_ID = m.RECEIVER_ID
         WHERE (m.SENDER_ID = :u1 AND m.RECEIVER_ID = :u2)
            OR (m.SENDER_ID = :u2 AND m.RECEIVER_ID = :u1)
            OR (m.RECEIVER_ID IS NULL AND (m.SENDER_ID = :u1 OR m.SENDER_ID = :u2))
         ORDER BY m.MESSAGE_ID ASC`
      : `SELECT m.MESSAGE_ID, m.SENDER_ID, m.RECEIVER_ID, m.MESSAGE_TEXT,
                m.ATTACHMENT_DATA, m.ATTACHMENT_NAME, m.ATTACHMENT_TYPE, m.ATTACHMENT_SIZE,
                m.IS_READ, m.CREATED_AT,
                s.FULL_NAME AS SENDER_NAME, s.ROLE AS SENDER_ROLE, s.PROFILE_IMAGE AS SENDER_AVATAR,
                r.FULL_NAME AS RECEIVER_NAME
         FROM ${table} m
         JOIN USERS s ON s.USER_ID = m.SENDER_ID
         LEFT JOIN USERS r ON r.USER_ID = m.RECEIVER_ID
         WHERE m.SENDER_ID = :u1 OR m.RECEIVER_ID = :u1 OR m.RECEIVER_ID IS NULL
         ORDER BY m.MESSAGE_ID ASC`;

    const binds = user2Id ? { u1: Number(user1Id), u2: Number(user2Id) } : { u1: Number(user1Id) };
    const result = await c.execute(sql, binds, {
      outFormat: oracledb.OUT_FORMAT_OBJECT,
      fetchInfo: {
        MESSAGE_TEXT: { type: oracledb.STRING },
        ATTACHMENT_DATA: { type: oracledb.STRING },
      },
    });
    return result.rows || [];
  });
}

async function create(data) {
  return withConnection(async (c) => {
    const text = data.messageText !== undefined ? data.messageText : (data.message_text !== undefined ? data.message_text : (data.message || data.text || ""));
    const attData = data.attachmentData !== undefined ? data.attachmentData : (data.attachment_data !== undefined ? data.attachment_data : data.fileData || null);
    const attName = data.attachmentName !== undefined ? data.attachmentName : (data.attachment_name !== undefined ? data.attachment_name : data.fileName || null);
    const attType = data.attachmentType !== undefined ? data.attachmentType : (data.attachment_type !== undefined ? data.attachment_type : data.fileType || null);
    const attSize = data.attachmentSize !== undefined ? data.attachmentSize : (data.attachment_size !== undefined ? data.attachment_size : data.fileSize || null);

    const result = await c.execute(
      `INSERT INTO ${table} (SENDER_ID, RECEIVER_ID, MESSAGE_TEXT, ATTACHMENT_DATA, ATTACHMENT_NAME, ATTACHMENT_TYPE, ATTACHMENT_SIZE, IS_READ, CREATED_AT)
       VALUES (:sender_id, :receiver_id, :message_text, :attachment_data, :attachment_name, :attachment_type, :attachment_size, 0, SYSTIMESTAMP)
       RETURNING MESSAGE_ID INTO :message_id`,
      {
        sender_id: Number(data.sender_id || data.senderId),
        receiver_id: data.receiver_id || data.receiverId ? Number(data.receiver_id || data.receiverId) : null,
        message_text: text,
        attachment_data: attData,
        attachment_name: attName,
        attachment_type: attType,
        attachment_size: attSize ? Number(attSize) : null,
        message_id: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
      },
      { autoCommit: true },
    );

    const messageId = result.outBinds?.message_id?.[0] || null;
    return { messageId, ...data };
  });
}

async function markAsRead(senderId, receiverId) {
  return withConnection(async (c) => {
    return c.execute(
      `UPDATE ${table}
       SET IS_READ = 1
       WHERE SENDER_ID = :sender_id AND RECEIVER_ID = :receiver_id AND IS_READ = 0`,
      { sender_id: Number(senderId), receiver_id: Number(receiverId) },
      { autoCommit: true },
    );
  });
}

async function getRecentConversations(userId) {
  return withConnection(async (c) => {
    const uid = Number(userId);
    const result = await c.execute(
      `SELECT u.USER_ID, u.FULL_NAME, u.EMAIL, u.ROLE, u.PHONE,
              NVL(u.STATUS, 'Active') AS STATUS, u.LAST_LOGIN,
              s.JOB_TITLE, s.DEPARTMENT,
              (
                SELECT COUNT(*)
                FROM ${table} m2
                WHERE m2.SENDER_ID = u.USER_ID
                  AND m2.RECEIVER_ID = :uid1
                  AND m2.IS_READ = 0
              ) AS UNREAD_COUNT,
              (
                SELECT MAX(m3.CREATED_AT)
                FROM ${table} m3
                WHERE (m3.SENDER_ID = :uid2 AND m3.RECEIVER_ID = u.USER_ID)
                   OR (m3.SENDER_ID = u.USER_ID AND m3.RECEIVER_ID = :uid3)
              ) AS LAST_MESSAGE_TIME
       FROM USERS u
       LEFT JOIN STAFF s ON s.USER_ID = u.USER_ID
       WHERE u.USER_ID != :uid4
       ORDER BY UNREAD_COUNT DESC, LAST_MESSAGE_TIME DESC NULLS LAST, u.FULL_NAME ASC`,
      { uid1: uid, uid2: uid, uid3: uid, uid4: uid },
      { outFormat: oracledb.OUT_FORMAT_OBJECT },
    );
    return result.rows || [];
  });
}

module.exports = {
  listBetweenUsers,
  create,
  markAsRead,
  getRecentConversations,
};
