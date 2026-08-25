const model = require("../models/reportModel");
async function summary(req, res) {
  res.json(await model.summary());
}
module.exports = { summary };
