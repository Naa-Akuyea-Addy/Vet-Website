const model = require("../models/appointmentModel");
async function list(req, res) {
  res.json(await model.list());
}
async function create(req, res) {
  await model.create(req.body);
  res.status(201).json({ message: "Appointment created" });
}
module.exports = { list, create };
