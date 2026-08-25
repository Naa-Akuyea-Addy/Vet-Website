const model = require("../models/billingModel");
async function list(req, res) {
  res.json(await model.list());
}
async function create(req, res) {
  await model.create(req.body);
  res.status(201).json({ message: "Invoice created" });
}
module.exports = { list, create };
