// backend/config/database.js
const path = require("path");
const oracledb = require("oracledb");
require("dotenv").config({ path: path.join(__dirname, "../../.env") });
require("dotenv").config();

// ============================================
// DATABASE CONFIGURATION WITH POOLING
// ============================================

const dbConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  connectString: process.env.DB_CONNECT,
  poolMin: 2, // Minimum connections in pool
  poolMax: 10, // Maximum connections in pool
  poolIncrement: 1, // Connections to add when pool grows
};

let pool;

// ============================================
// POOL MANAGEMENT
// ============================================

/**
 * Initialize the connection pool
 * Call this once when your server starts
 */
async function initializePool() {
  try {
    pool = await oracledb.createPool(dbConfig);
    console.log("✅ Database connection pool created");
    return pool;
  } catch (err) {
    console.error("❌ Error creating connection pool:", err);
    throw err;
  }
}

/**
 * Get a connection from the pool
 */
async function getConnection() {
  if (!pool) {
    await initializePool();
  }
  return await pool.getConnection();
}

/**
 * Close the pool (for graceful shutdown)
 */
async function closePool() {
  if (pool) {
    await pool.close();
    console.log("✅ Database connection pool closed");
  }
}

// ============================================
// QUERY EXECUTION
// ============================================

/**
 * Execute a query and return results as objects
 * @param {string} sql - SQL query with named parameters
 * @param {object} params - Parameter values
 * @returns {object} - Query results with rows as objects
 */
async function executeQuery(sql, params = {}) {
  let connection;
  try {
    connection = await getConnection();
    const result = await connection.execute(sql, params, {
      outFormat: oracledb.OUT_FORMAT_OBJECT,
    });
    return result;
  } finally {
    if (connection) await connection.close();
  }
}

/**
 * Execute a query and return results as arrays
 * @param {string} sql - SQL query with named parameters
 * @param {object} params - Parameter values
 * @returns {object} - Query results with rows as arrays
 */
async function executeQueryArray(sql, params = {}) {
  let connection;
  try {
    connection = await getConnection();
    const result = await connection.execute(sql, params);
    return result;
  } finally {
    if (connection) await connection.close();
  }
}

/**
 * Execute with connection (for transactions)
 */
async function withConnection(work) {
  let connection;
  try {
    connection = await getConnection();
    return await work(connection);
  } finally {
    if (connection) await connection.close();
  }
}

/**
 * Check if database is connected
 */
async function checkConnection() {
  return withConnection((connection) =>
    connection.execute("SELECT 1 AS connected FROM dual"),
  );
}

// ============================================
// EXPORTS
// ============================================

module.exports = {
  dbConfig,
  initializePool,
  getConnection,
  closePool,
  executeQuery,
  executeQueryArray,
  withConnection,
  checkConnection,
};
