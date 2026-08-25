const model = require("../models/inventoryModel");
async function list(req, res) {
  res.json(await model.list());
}
module.exports = { list };
