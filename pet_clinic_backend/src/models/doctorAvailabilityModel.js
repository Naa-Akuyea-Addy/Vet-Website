const oracledb = require("oracledb");
const { withConnection } = require("../config/database");

async function list() {
  return withConnection((connection) =>
    connection.execute(
      `SELECT s.STAFF_ID, s.USER_ID, s.FULL_NAME, s.DEPARTMENT, s.JOB_TITLE,
              s.PHONE, s.EMAIL, s.STATUS AS STAFF_STATUS,
              NVL(a.AVAILABILITY_STATUS, 'Available') AS AVAILABILITY_STATUS,
              NVL(a.START_TIME, '08:00') AS START_TIME,
              NVL(a.END_TIME, '18:00') AS END_TIME,
              a.LEAVE_REASON
       FROM STAFF s
       LEFT JOIN DOCTOR_AVAILABILITY a ON a.STAFF_ID = s.STAFF_ID
       ORDER BY s.FULL_NAME`,
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT },
    ).then((result) => result.rows || []),
  );
}

async function upsert(staffId, data) {
  return withConnection((connection) =>
    connection.execute(
      `MERGE INTO DOCTOR_AVAILABILITY target
       USING (SELECT :staff_id AS staff_id FROM DUAL) source
       ON (target.STAFF_ID = source.STAFF_ID)
       WHEN MATCHED THEN UPDATE SET
         AVAILABILITY_STATUS = :availability_status,
         START_TIME = :start_time,
         END_TIME = :end_time,
         LEAVE_REASON = :leave_reason,
         UPDATED_AT = SYSTIMESTAMP
       WHEN NOT MATCHED THEN INSERT (
         STAFF_ID, AVAILABILITY_STATUS, START_TIME, END_TIME, LEAVE_REASON, UPDATED_AT
       ) VALUES (
         :staff_id, :availability_status, :start_time, :end_time, :leave_reason, SYSTIMESTAMP
       )`,
      {
        staff_id: staffId,
        availability_status: data.availabilityStatus,
        start_time: data.startTime || null,
        end_time: data.endTime || null,
        leave_reason: data.leaveReason || null,
      },
      { autoCommit: true },
    ),
  );
}

module.exports = { list, upsert };
