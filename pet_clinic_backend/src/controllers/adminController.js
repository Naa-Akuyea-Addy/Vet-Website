const model = require("../models/adminModel");

async function messages(req, res) {
  res.json(await model.listMessages());
}

async function roles(req, res) {
  res.json(await model.listRoles());
}

async function settings(req, res) {
  res.json(await model.listSettings());
}

async function notifications(req, res) {
  res.json(await model.listNotifications());
}

module.exports = { messages, roles, settings, notifications };
