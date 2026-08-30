const model = require("../models/staffModel");

async function list(req, res, next) {
  try {
    const rows = await model.list();
    res.json({ success: true, data: rows });
  } catch (error) { next(error); }
}

async function create(req, res, next) {
  try {
    await model.create(req.body);
    res.status(201).json({ success: true, message: "Staff member added" });
  } catch (error) { next(error); }
}

async function update(req, res, next) {
  try {
    await model.update(req.params.id, req.body);
    res.json({ success: true, message: "Staff member updated" });
  } catch (error) { next(error); }
}

async function remove(req, res, next) {
  try {
    await model.remove(req.params.id);
    res.json({ success: true, message: "Staff member deleted" });
  } catch (error) { next(error); }
}

module.exports = { list, create, update, remove };
