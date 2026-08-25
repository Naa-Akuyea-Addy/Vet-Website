const settings = new Map();
async function get(req, res) {
  res.json(Object.fromEntries(settings));
}
async function update(req, res) {
  Object.entries(req.body || {}).forEach(([key, value]) =>
    settings.set(key, value),
  );
  res.json({
    message: "Settings updated",
    settings: Object.fromEntries(settings),
  });
}
module.exports = { get, update };
