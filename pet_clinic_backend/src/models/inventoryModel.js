const oracledb = require("oracledb");
try {
  oracledb.fetchAsString = [oracledb.CLOB];
} catch (e) {}
const { withConnection } = require("../config/database");

async function list() {
  return withConnection((c) =>
    c
      .execute(
        "SELECT INVENTORY_ID, ITEM_NAME, CATEGORY, QUANTITY, REORDER_LEVEL, UNIT_COST, SUPPLIER, EXPIRY_DATE, UPDATED_AT FROM INVENTORY ORDER BY INVENTORY_ID DESC",
        [],
        { outFormat: oracledb.OUT_FORMAT_OBJECT },
      )
      .then((r) => r.rows || []),
  );
}

async function create(data) {
  return withConnection((c) =>
    c.execute(
      `INSERT INTO INVENTORY (ITEM_NAME, CATEGORY, QUANTITY, REORDER_LEVEL, UNIT_COST, SUPPLIER)
       VALUES (:item_name, :category, :quantity, NVL(:reorder_level, 10), :unit_cost, :supplier)`,
      {
        item_name: data.item_name || data.name,
        category: data.category || "General",
        quantity: Number(data.quantity || 0),
        reorder_level: Number(data.reorder_level || 10),
        unit_cost: Number(data.unit_cost || data.unit_price || data.price || 0),
        supplier: data.supplier || "PharmaVet Supplies",
      },
      { autoCommit: true },
    ),
  );
}

async function update(id, data) {
  return withConnection((c) =>
    c.execute(
      `UPDATE INVENTORY 
       SET QUANTITY = :quantity, UNIT_COST = :unit_cost, UPDATED_AT = SYSTIMESTAMP 
       WHERE INVENTORY_ID = :id`,
      {
        id,
        quantity: Number(data.quantity || 0),
        unit_cost: Number(data.unit_cost || data.price || 0),
      },
      { autoCommit: true },
    ),
  );
}

async function remove(id) {
  return withConnection((c) =>
    c.execute("DELETE FROM INVENTORY WHERE INVENTORY_ID = :id", { id }, { autoCommit: true }),
  );
}

module.exports = { list, create, update, remove };
