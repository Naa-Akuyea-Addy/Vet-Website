const oracledb = require("oracledb");

const dbConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  connectString: process.env.DB_CONNECT,
};

async function withConnection(work) {
  let connection;
  try {
    connection = await oracledb.getConnection(dbConfig);
    return await work(connection);
  } finally {
    if (connection) await connection.close();
  }
}

async function checkConnection() {
  return withConnection((connection) =>
    connection.execute("SELECT 1 AS connected FROM dual"),
  );
}

module.exports = { dbConfig, withConnection, checkConnection };
