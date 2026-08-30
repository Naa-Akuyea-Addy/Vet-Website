const oracledb = require("oracledb");
const { withConnection } = require("../config/database");

const table = "BILLING";

async function list() {
  return withConnection((c) =>
    c
      .execute(`SELECT * FROM ${table} ORDER BY BILLING_ID DESC`, [], {
        outFormat: oracledb.OUT_FORMAT_OBJECT,
      })
      .then((r) => r.rows || []),
  );
}

async function create(data) {
  return withConnection((c) =>
    c.execute(
      `INSERT INTO ${table} (AMOUNT, STATUS, DESCRIPTION, PAYMENT_METHOD, ISSUED_AT, PAID_AT)
       VALUES (:amount, NVL(:status, 'Paid'), :description, :payment_method, SYSTIMESTAMP, 
               CASE WHEN :status = 'Paid' THEN SYSTIMESTAMP ELSE NULL END)`,
      {
        amount: Number(data.amount || data.total || 0),
        status: data.status || 'Paid',
        description: data.description || data.item || 'Veterinary Service',
        payment_method: data.payment_method || data.paymentMethod || 'Mobile Money',
      },
      { autoCommit: true },
    ),
  );
}

async function updateStatus(id, status) {
  return withConnection((c) =>
    c.execute(
      `UPDATE ${table} 
       SET STATUS = :status, 
           PAID_AT = CASE WHEN :status = 'Paid' THEN SYSTIMESTAMP ELSE NULL END 
       WHERE BILLING_ID = :id`,
      { id, status },
      { autoCommit: true },
    ),
  );
}

async function remove(id) {
  return withConnection((c) =>
    c.execute(
      `DELETE FROM ${table} WHERE BILLING_ID = :id`,
      { id },
      { autoCommit: true },
    ),
  );
}

module.exports = { list, create, updateStatus, remove };
