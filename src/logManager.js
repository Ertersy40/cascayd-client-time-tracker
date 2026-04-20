const fs = require('fs');
const path = require('path');
const { logsDir } = require('./config');

let logWatchers = {};
let updateTimeout = null;

function getTodayLogFile() {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  return path.join(logsDir, `activity_${today}.log`);
}

function loadLogsForDate(date) {
  const activityFile = path.join(logsDir, `activity_${date}.log`);
  const activity = [];

  // Parse activity log
  if (fs.existsSync(activityFile)) {
    const content = fs.readFileSync(activityFile, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());

    lines.forEach(line => {
      const parts = line.split(' | ');
      if (parts.length >= 3) {
        const timestamp = parts[0];
        const time = new Date(timestamp).toLocaleTimeString();
        const app = parts[1];

        // Skip INACTIVE entries from time calculations
        if (app === 'INACTIVE') {
          return;
        }

        activity.push({
          time: time,
          timestamp: timestamp,
          app: app,
          title: parts[2]
        });
      }
    });
  }

  return { activity };
}

function watchLogFiles(date, dashboardWindow) {
  // Stop watching old files
  Object.values(logWatchers).forEach(watcher => watcher.close());
  logWatchers = {};

  const activityFile = path.join(logsDir, `activity_${date}.log`);

  // Debounced update function
  const sendUpdate = () => {
    if (updateTimeout) {
      clearTimeout(updateTimeout);
    }
    updateTimeout = setTimeout(() => {
      if (dashboardWindow) {
        const data = loadLogsForDate(date);
        dashboardWindow.webContents.send('logs-data', data);
      }
    }, 200); // Wait 200ms before updating
  };

  // Watch activity log (create if doesn't exist)
  if (!fs.existsSync(activityFile)) {
    fs.writeFileSync(activityFile, '');
  }
  logWatchers.activity = fs.watch(activityFile, (eventType) => {
    if (eventType === 'change') {
      sendUpdate();
    }
  });
}

function closeLogWatchers() {
  Object.values(logWatchers).forEach(watcher => watcher.close());
  logWatchers = {};
}

module.exports = {
  getTodayLogFile,
  loadLogsForDate,
  watchLogFiles,
  closeLogWatchers
};
