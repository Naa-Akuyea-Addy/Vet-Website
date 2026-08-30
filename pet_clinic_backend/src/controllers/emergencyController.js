const model = require("../models/emergencyModel");

async function list(req, res, next) {
  try {
    const rows = await model.list();
    res.json({ success: true, data: rows });
  } catch (error) { next(error); }
}

async function create(req, res, next) {
  try {
    await model.create(req.body);
    res.status(201).json({ success: true, message: "Emergency case created" });
  } catch (error) { next(error); }
}

async function updateStatus(req, res, next) {
  try {
    await model.updateStatus(req.params.id, req.body.status);
    res.json({ success: true, message: "Status updated" });
  } catch (error) { next(error); }
}

async function remove(req, res, next) {
  try {
    await model.remove(req.params.id);
    res.json({ success: true, message: "Case removed" });
  } catch (error) { next(error); }
}

module.exports = { list, create, updateStatus, remove };
