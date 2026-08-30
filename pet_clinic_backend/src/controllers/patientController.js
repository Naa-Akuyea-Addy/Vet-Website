const model = require("../models/patientModel");

async function list(req, res, next) {
  try {
    const rows = await model.list();
    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
}

async function findById(req, res, next) {
  try {
    const row = await model.findById(req.params.id);
    if (!row) return res.status(404).json({ success: false, message: "Patient not found" });
    res.json({ success: true, data: row });
  } catch (error) {
    next(error);
  }
}

async function create(req, res, next) {
  try {
    await model.create(req.body);
    res.status(201).json({ success: true, message: "Patient record created" });
  } catch (error) {
    next(error);
  }
}

async function update(req, res, next) {
  try {
    await model.update(req.params.id, req.body);
    res.json({ success: true, message: "Patient record updated" });
  } catch (error) {
    next(error);
  }
}

async function remove(req, res, next) {
  try {
    await model.remove(req.params.id);
    res.json({ success: true, message: "Patient record deleted" });
  } catch (error) {
    next(error);
  }
}

module.exports = { list, findById, create, update, remove };
