const model = require("../models/recurringBlockModel");

async function list(req, res, next) {
  try {
    res.json({ success: true, data: await model.list() });
  } catch (error) {
    next(error);
  }
}

async function create(req, res, next) {
  try {
    const { title, daysOfWeek, startTime, endTime, icon } = req.body;
    if (!title || !Array.isArray(daysOfWeek) || !daysOfWeek.length || !startTime || !endTime) {
      return res.status(400).json({ success: false, message: "Title, days, start time, and end time are required" });
    }
    const blockId = await model.create({ title, daysOfWeek, startTime, endTime, icon });
    res.status(201).json({ success: true, blockId });
  } catch (error) {
    next(error);
  }
}

async function remove(req, res, next) {
  try {
    const result = await model.remove(Number(req.params.id));
    if (!result.rowsAffected) return res.status(404).json({ success: false, message: "Recurring block not found" });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
}

module.exports = { list, create, remove };
