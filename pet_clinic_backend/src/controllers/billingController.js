const model = require("../models/billingModel");

async function list(req, res, next) {
  try {
    const rows = await model.list();
    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
}

async function create(req, res, next) {
  try {
    await model.create(req.body);
    res.status(201).json({ success: true, message: "Invoice created successfully" });
  } catch (error) {
    next(error);
  }
}

async function updateStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { status } = req.body;
    await model.updateStatus(id, status);
    res.json({ success: true, message: "Billing status updated" });
  } catch (error) {
    next(error);
  }
}

async function remove(req, res, next) {
  try {
    const { id } = req.params;
    await model.remove(id);
    res.json({ success: true, message: "Invoice deleted" });
  } catch (error) {
    next(error);
  }
}

module.exports = { list, create, updateStatus, remove };
