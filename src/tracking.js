const fs = require('fs');
const desktopIdle = require('desktop-idle');
const { IDLE_THRESHOLD } = require('./config');
const { getTodayLogFile } = require('./logManager');
const { syncEntry } = require('./supabase');

let activeWin = null;
let windowTrackInterval = null;
let endOfDayCheckInterval = null;
let lastWindowTitle = '';
let lastWindowOwner = '';
let wasInactive = false;

async function startTracking(updateTrayCallback, checkEndOfDayCallback) {
  if (windowTrackInterval) {
    console.log('Tracking already started');
    return;
  }

  console.log('Starting time tracking...');

  // Dynamically import active-win (ES module)
  if (!activeWin) {
    const activeWinModule = await import('active-win');
    activeWin = activeWinModule.activeWindow || activeWinModule.default;
  }

  // Start tracking windows every 10 seconds
  trackActiveWindow();
  windowTrackInterval = setInterval(trackActiveWindow, 10 * 1000);

  // Start checking for end of day every minute
  if (!endOfDayCheckInterval) {
    endOfDayCheckInterval = setInterval(() => {
      checkEndOfDayCallback();
    }, 60 * 1000);
  }

  // Update tray
  if (updateTrayCallback) {
    updateTrayCallback();
  }
}

function stopTracking(updateTrayCallback) {
  if (windowTrackInterval) {
    clearInterval(windowTrackInterval);
    windowTrackInterval = null;
    console.log('Stopped window tracking');
  }

  if (endOfDayCheckInterval) {
    clearInterval(endOfDayCheckInterval);
    endOfDayCheckInterval = null;
    console.log('Stopped end-of-day checks');
  }

  // Update tray
  if (updateTrayCallback) {
    updateTrayCallback();
  }

  // Log that tracking stopped
  const timestamp = new Date().toISOString();
  const logEntry = `${timestamp} | SYSTEM | Tracking stopped by user\n`;
  const logFile = getTodayLogFile();
  fs.appendFileSync(logFile, logEntry);
  syncEntry({ timestamp, app: 'SYSTEM', title: 'Tracking stopped by user', entryType: 'SYSTEM' });
}

async function trackActiveWindow() {
  try {
    if (!activeWin) return;

    // Check idle time in seconds
    const idleTime = desktopIdle.getIdleTime();
    const isIdle = idleTime >= IDLE_THRESHOLD;

    // If user was active but is now idle, log the transition
    if (isIdle && !wasInactive) {
      const timestamp = new Date().toISOString();
      const logEntry = `${timestamp} | INACTIVE | User idle for ${Math.floor(idleTime)}s (threshold: ${IDLE_THRESHOLD}s)\n`;
      const logFile = getTodayLogFile();
      fs.appendFileSync(logFile, logEntry);
      syncEntry({ timestamp, app: 'INACTIVE', title: `User idle for ${Math.floor(idleTime)}s`, entryType: 'INACTIVE' });
      wasInactive = true;
      console.log(`[TRACK] User became inactive (idle: ${idleTime}s)`);
      return;
    }

    // If still idle, don't log anything
    if (isIdle) {
      return;
    }

    // User is active - log activity
    if (wasInactive) {
      // User became active again
      wasInactive = false;
      console.log(`[TRACK] User became active again (idle: ${idleTime}s)`);
    }

    const window = await activeWin();
    if (!window) return;

    const title = window.title || 'Unknown';
    const owner = window.owner?.name || 'Unknown';

    // Only log if window changed
    if (title !== lastWindowTitle || owner !== lastWindowOwner) {
      const timestamp = new Date().toISOString();
      const logEntry = `${timestamp} | ${owner} | ${title}\n`;
      const logFile = getTodayLogFile();

      fs.appendFileSync(logFile, logEntry);
      syncEntry({ timestamp, app: owner, title, entryType: 'ACTIVE' });

      lastWindowTitle = title;
      lastWindowOwner = owner;
    }
  } catch (error) {
    console.error('[TRACK] ERROR:', error);
  }
}

function isTracking() {
  return windowTrackInterval !== null;
}

module.exports = {
  startTracking,
  stopTracking,
  isTracking
};
