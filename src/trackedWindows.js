const fs = require('fs');
const { trackedWindowsPath, GROUP_COLORS } = require('./config');

function loadTrackedWindows() {
  if (fs.existsSync(trackedWindowsPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(trackedWindowsPath, 'utf-8'));
      return {
        groups: data.groups || [],
        windows: data.windows || []
      };
    } catch (e) {
      return { groups: [], windows: [] };
    }
  }
  return { groups: [], windows: [] };
}

function saveTrackedWindows(groups, windows) {
  const data = { groups, windows };
  fs.writeFileSync(trackedWindowsPath, JSON.stringify(data, null, 2));
}

function getRandomColor() {
  return GROUP_COLORS[Math.floor(Math.random() * GROUP_COLORS.length)];
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

module.exports = {
  loadTrackedWindows,
  saveTrackedWindows,
  getRandomColor,
  generateId
};
