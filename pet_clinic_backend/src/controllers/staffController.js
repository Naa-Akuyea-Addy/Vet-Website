const model = require("../models/staffModel");
async function list(req, res) {
  res.json(await model.list());
}
module.exports = { list };
