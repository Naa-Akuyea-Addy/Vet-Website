const model = require("../models/appointmentModel");

async function list(req, res, next) {
  try {
    const rows = await model.list();
    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
}

async function get(req, res, next) {
  try {
    const id = req.params.id;
    const row = await model.findById(id);
    if (!row) return res.status(404).json({ success: false, message: 'Appointment not found' });
    res.json({ success: true, data: row });
  } catch (error) {
    next(error);
  }
}

async function create(req, res, next) {
  try {
    const result = await model.create(req.body);
    res.status(201).json({
      success: true,
      appointment_id: result.appointmentId,
      veterinarian_id: result.veterinarianId,
      message: result.veterinarianId
        ? "Appointment created and veterinarian assigned"
        : "Appointment created, but no eligible veterinarian is available",
    });
  } catch (error) {
    next(error);
  }
}

async function updateStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { status } = req.body;
    await model.updateStatus(id, status);
    res.json({ success: true, message: "Status updated successfully" });
  } catch (error) {
    next(error);
  }
}

async function update(req, res, next) {
  try {
    const { id } = req.params;
    await model.update(id, req.body);
    res.json({ success: true, message: 'Appointment updated successfully' });
  } catch (error) {
    next(error);
  }
}

async function remove(req, res, next) {
  try {
    const { id } = req.params;
    const result = await model.remove(id);
    if (!result.rowsAffected) {
      return res.status(404).json({ success: false, message: "Appointment not found" });
    }
    res.json({ success: true, message: "Appointment deleted successfully" });
  } catch (error) {
    next(error);
  }
}

module.exports = { list, get, create, update, updateStatus, remove };
