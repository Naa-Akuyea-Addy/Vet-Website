const model = require("../models/patientModel");
async function list(req, res) {
  res.json(await model.list());
}
async function getById(req, res) {
  const patient = await model.findById(Number(req.params.id));
  if (!patient) return res.status(404).json({ message: "Patient not found" });
  res.json(patient);
}
module.exports = { list, getById };
