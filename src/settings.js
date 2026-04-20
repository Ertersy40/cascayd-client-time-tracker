const fs = require('fs');
const { settingsPath } = require('./config');

function loadSettings() {
  if (fs.existsSync(settingsPath)) {
    try {
      return JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
    } catch (e) {
      return { setupCompleted: false };
    }
  }
  return { setupCompleted: false };
}

function saveSettings(settings) {
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
}

function isFirstRun() {
  const settings = loadSettings();
  return !settings.setupCompleted;
}

module.exports = {
  loadSettings,
  saveSettings,
  isFirstRun
};
