const model = require("../models/emergencyModel");
async function list(req, res) {
  res.json(await model.list());
}
async function create(req, res) {
  await model.create({ ...req.body, status: req.body.status || "OPEN" });
  res.status(201).json({ message: "Emergency case created" });
}
module.exports = { list, create };
