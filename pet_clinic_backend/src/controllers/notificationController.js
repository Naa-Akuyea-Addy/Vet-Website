const notificationModel = require("../models/notificationModel");

async function list(req, res, next) {
  try {
    const data = await notificationModel.listForUser(req.user.id);
    res.json({ success: true, data });
  } catch (error) { next(error); }
}

async function read(req, res, next) {
  try {
    await notificationModel.markRead(req.user.id, req.params.id);
    res.json({ success: true });
  } catch (error) { next(error); }
}

async function readAll(req, res, next) {
  try {
    await notificationModel.markAllRead(req.user.id);
    res.json({ success: true });
  } catch (error) { next(error); }
}

module.exports = { list, read, readAll };
