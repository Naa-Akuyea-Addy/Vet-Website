const oracledb = require("oracledb");
const { withConnection } = require("../config/database");

async function list() {
  return withConnection((connection) =>
    connection.execute(
      "SELECT BLOCK_ID, TITLE, DAYS_OF_WEEK, START_TIME, END_TIME, ICON, IS_ACTIVE FROM RECURRING_BLOCKS WHERE IS_ACTIVE = 'Y' ORDER BY START_TIME, TITLE",
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT },
    ).then((result) => result.rows || []),
  );
}

async function create(data) {
  return withConnection(async (connection) => {
    const result = await connection.execute(
      `INSERT INTO RECURRING_BLOCKS (TITLE, DAYS_OF_WEEK, START_TIME, END_TIME, ICON)
       VALUES (:title, :days_of_week, :start_time, :end_time, :icon)
       RETURNING BLOCK_ID INTO :block_id`,
      {
        title: data.title,
        days_of_week: data.daysOfWeek.join(","),
        start_time: data.startTime,
        end_time: data.endTime,
        icon: data.icon || "block",
        block_id: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
      },
      { autoCommit: true },
    );
    return result.outBinds.block_id[0];
  });
}

async function remove(id) {
  return withConnection((connection) =>
    connection.execute(
      "DELETE FROM RECURRING_BLOCKS WHERE BLOCK_ID = :id",
      { id },
      { autoCommit: true },
    ),
  );
}

module.exports = { list, create, remove };
