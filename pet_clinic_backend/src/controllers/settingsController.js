const fs = require('fs');
const path = require('path');

const SETTINGS_FILE = path.join(__dirname, '../../database/settings.json');

function loadSettings() {
  if (fs.existsSync(SETTINGS_FILE)) {
    try {
      const data = fs.readFileSync(SETTINGS_FILE, 'utf8');
      return new Map(Object.entries(JSON.parse(data)));
    } catch (e) {
      console.error("Failed to load settings:", e);
    }
  }
  return new Map();
}

function saveSettings(settingsMap) {
  try {
    const dir = path.dirname(SETTINGS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(Object.fromEntries(settingsMap), null, 2), 'utf8');
  } catch (e) {
    console.error("Failed to save settings:", e);
  }
}

const settings = loadSettings();

async function get(req, res) {
  res.json(Object.fromEntries(settings));
}

async function update(req, res) {
  Object.entries(req.body || {}).forEach(([key, value]) =>
    settings.set(key, value),
  );
  
  saveSettings(settings);
  
  res.json({
    message: "Settings updated",
    settings: Object.fromEntries(settings),
  });
}

module.exports = { get, update };
