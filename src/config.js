const { app } = require('electron');
const path = require('path');
const fs = require('fs');

// Load environment variables
const envPath = path.join(__dirname, '..', '.env');
require('dotenv').config({ path: envPath });

// Constants
const IDLE_THRESHOLD = 180; // 3 minutes in seconds
const END_OF_DAY_HOUR = 17;
const END_OF_DAY_MINUTE = 0;
const MAX_GAP = 600; // 10 minutes cap for time calculation
const DEFAULT_LAST = 120; // 2 minutes for last entry

// Paths
const logsDir = path.join(app.getPath('userData'), 'logs');
const trackedWindowsPath = path.join(app.getPath('userData'), 'tracked_windows.json');
const settingsPath = path.join(app.getPath('userData'), 'settings.json');

// Create logs directory if it doesn't exist
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Group colors
const GROUP_COLORS = [
  '#10b981', // green
  '#3b82f6', // blue
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316', // orange
  '#14b8a6', // teal
  '#a855f7', // violet
];

module.exports = {
  IDLE_THRESHOLD,
  END_OF_DAY_HOUR,
  END_OF_DAY_MINUTE,
  MAX_GAP,
  DEFAULT_LAST,
  logsDir,
  trackedWindowsPath,
  settingsPath,
  GROUP_COLORS
};
