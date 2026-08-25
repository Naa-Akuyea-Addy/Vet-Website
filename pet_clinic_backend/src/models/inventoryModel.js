const { withConnection } = require("../config/database");
async function list() {
  return withConnection((c) =>
    c
      .execute("SELECT * FROM INVENTORY", [], { outFormat: 4002 })
      .then((r) => r.rows),
  );
}
module.exports = { list };
