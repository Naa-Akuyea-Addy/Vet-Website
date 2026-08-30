const oracledb = require("oracledb");
try {
  oracledb.fetchAsString = [oracledb.CLOB];
} catch (e) {}
const { withConnection } = require("../config/database");

async function list() {
  return withConnection((c) =>
    c
      .execute(
        "SELECT EMERGENCY_ID, PATIENT_ID, PATIENT_NAME, OWNER_NAME, DESCRIPTION, PRIORITY, STATUS, ASSIGNED_STAFF_ID, CREATED_AT, RESOLVED_AT FROM EMERGENCY_CASES ORDER BY EMERGENCY_ID DESC",
        [],
        { outFormat: oracledb.OUT_FORMAT_OBJECT },
      )
      .then((r) => r.rows || []),
  );
}

async function create(data) {
  return withConnection((c) =>
    c.execute(
      `INSERT INTO EMERGENCY_CASES (PATIENT_NAME, OWNER_NAME, DESCRIPTION, STATUS, PRIORITY, CREATED_AT)
       VALUES (:patient_name, :owner_name, :description, NVL(:status, 'In Progress'), NVL(:priority, 'Urgent'), SYSTIMESTAMP)`,
      {
        patient_name: data.patient_name || data.patient || "Pet",
        owner_name: data.owner_name || data.owner || "Owner",
        description: data.description || data.reason || "Emergency case reported.",
        status: data.status || "In Progress",
        priority: data.priority || data.severity || "Urgent",
      },
      { autoCommit: true },
    ),
  );
}

async function updateStatus(id, status) {
  return withConnection((c) =>
    c.execute(
      `UPDATE EMERGENCY_CASES 
       SET STATUS = :status, 
           RESOLVED_AT = CASE WHEN :status IN ('Resolved', 'Discharged') THEN SYSTIMESTAMP ELSE NULL END 
       WHERE EMERGENCY_ID = :id`,
      { id, status },
      { autoCommit: true },
    ),
  );
}

async function remove(id) {
  return withConnection((c) =>
    c.execute("DELETE FROM EMERGENCY_CASES WHERE EMERGENCY_ID = :id", { id }, { autoCommit: true }),
  );
}

module.exports = { list, create, updateStatus, remove };
