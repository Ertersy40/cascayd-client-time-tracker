const { app, Tray, Menu, nativeImage, BrowserWindow, ipcMain } = require('electron');
const { autoUpdater } = require('electron-updater');
const fs = require('fs');
const path = require('path');
const desktopIdle = require('desktop-idle');
const AutoLaunch = require('auto-launch');

// Load .env from app directory (works in dev and when packaged)
const envPath = path.join(__dirname, '.env');
require('dotenv').config({ path: envPath });

// Prevent any window from showing
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('no-sandbox');

let tray = null;
let windowTrackInterval = null;
let mainWindow = null;
let dashboardWindow = null;
let setupWindow = null;
let lastWindowTitle = '';
let lastWindowOwner = '';
let activeWin = null;
let logWatchers = {}; // File watchers for log files
let updateTimeout = null; // Debounce file watcher updates
let wasInactive = false; // Track if user was inactive in previous check
let endOfDayCheckInterval = null; // Check for 5pm
let hasAskedTodayAt5pm = false; // Track if we already asked today at 5pm
let continueUntil = null; // Timestamp for when to ask again after extension

// Inactivity threshold in seconds (10 seconds for testing)
const IDLE_THRESHOLD = 10;

// End of day time (5pm = 17:00)
const END_OF_DAY_HOUR = 17;
const END_OF_DAY_MINUTE = 0;

// Auto-launch configuration
const autoLauncher = new AutoLaunch({
  name: 'Cascayd TimeTracker',
  path: app.getPath('exe'),
});

// Create logs directory
const logsDir = path.join(app.getPath('userData'), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Tracked windows file
const trackedWindowsPath = path.join(app.getPath('userData'), 'tracked_windows.json');

// Settings file for first-run detection and configuration
const settingsPath = path.join(app.getPath('userData'), 'settings.json');

// Load settings
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

// Save settings
function saveSettings(settings) {
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
}

// Check if this is the first run
function isFirstRun() {
  const settings = loadSettings();
  return !settings.setupCompleted;
}

// Load tracked windows and groups
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

// Save tracked windows and groups
function saveTrackedWindows(groups, windows) {
  const data = { groups, windows };
  fs.writeFileSync(trackedWindowsPath, JSON.stringify(data, null, 2));
}

// Generate random color for groups
function getRandomColor() {
  const colors = [
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
  return colors[Math.floor(Math.random() * colors.length)];
}

// Generate unique ID
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Calculate time spent per window from activity log
function calculateWindowTime(activity) {
  const windowTimeMap = {};
  const MAX_GAP = 600; // Cap at 10 minutes
  const DEFAULT_LAST = 120; // 2 minutes for last entry

  for (let i = 0; i < activity.length; i++) {
    const current = activity[i];
    const key = `${current.app}|||${current.title}`; // Use ||| as separator to avoid conflicts

    if (!windowTimeMap[key]) {
      windowTimeMap[key] = {
        app: current.app,
        title: current.title,
        totalSeconds: 0
      };
    }

    if (i < activity.length - 1) {
      const next = activity[i + 1];
      const currentTime = new Date(current.timestamp);
      const nextTime = new Date(next.timestamp);
      const duration = (nextTime - currentTime) / 1000;

      // Only count duration if it's reasonable (less than 10 minutes)
      if (duration > 0 && duration <= MAX_GAP) {
        windowTimeMap[key].totalSeconds += duration;
      } else if (duration > MAX_GAP) {
        // Cap at max gap
        windowTimeMap[key].totalSeconds += MAX_GAP;
      }
    } else {
      // Last entry - use default duration
      windowTimeMap[key].totalSeconds += DEFAULT_LAST;
    }
  }

  // Convert map to sorted array
  const windows = Object.values(windowTimeMap);
  windows.sort((a, b) => b.totalSeconds - a.totalSeconds);

  return windows;
}

// Get today's log file
function getTodayLogFile() {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  return path.join(logsDir, `activity_${today}.log`);
}

// Watch log files for changes
function watchLogFiles(date) {
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

// Open setup window
function openSetupWindow() {
  if (setupWindow) {
    setupWindow.focus();
    return;
  }

  setupWindow = new BrowserWindow({
    width: 600,
    height: 500,
    title: 'Cascayd TimeTracker Setup',
    resizable: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  // Create a simple HTML setup page
  const setupHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      margin: 0;
      padding: 40px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100vh;
      box-sizing: border-box;
    }
    .container {
      background: rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(10px);
      border-radius: 20px;
      padding: 40px;
      max-width: 500px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    }
    h1 {
      margin: 0 0 20px 0;
      font-size: 32px;
      font-weight: 700;
    }
    p {
      font-size: 16px;
      line-height: 1.6;
      margin-bottom: 15px;
      opacity: 0.95;
    }
    .features {
      margin: 30px 0;
      padding: 0;
      list-style: none;
    }
    .features li {
      padding: 10px 0;
      padding-left: 30px;
      position: relative;
    }
    .features li:before {
      content: '✓';
      position: absolute;
      left: 0;
      font-weight: bold;
      font-size: 20px;
    }
    .checkbox-container {
      margin: 30px 0;
      display: flex;
      align-items: center;
      padding: 20px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 10px;
    }
    input[type="checkbox"] {
      width: 20px;
      height: 20px;
      margin-right: 15px;
      cursor: pointer;
    }
    label {
      cursor: pointer;
      font-size: 16px;
    }
    button {
      width: 100%;
      padding: 15px;
      font-size: 18px;
      font-weight: 600;
      background: white;
      color: #667eea;
      border: none;
      border-radius: 10px;
      cursor: pointer;
      transition: all 0.3s;
    }
    button:hover {
      transform: translateY(-2px);
      box-shadow: 0 10px 20px rgba(0, 0, 0, 0.2);
    }
    button:active {
      transform: translateY(0);
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Welcome to Cascayd TimeTracker!</h1>
    <p>This app will help you track your work time automatically.</p>

    <ul class="features">
      <li>Tracks active windows every 10 seconds</li>
      <li>Detects user inactivity automatically</li>
      <li>Organizes windows into custom groups</li>
      <li>Privacy-focused: all data stored locally</li>
    </ul>

    <div class="checkbox-container">
      <input type="checkbox" id="startOnBoot" checked>
      <label for="startOnBoot">Start automatically when I log in</label>
    </div>

    <button onclick="completeSetup()">Get Started</button>
  </div>

  <script>
    const { ipcRenderer } = require('electron');

    function completeSetup() {
      const startOnBoot = document.getElementById('startOnBoot').checked;
      ipcRenderer.send('complete-setup', { startOnBoot });
    }
  </script>
</body>
</html>
  `;

  setupWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(setupHtml));

  setupWindow.on('closed', () => {
    setupWindow = null;
  });
}

// Open dashboard window
function openDashboard() {
  if (dashboardWindow) {
    dashboardWindow.focus();
    return;
  }

  dashboardWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    title: 'Cascayd Time Tracker Dashboard',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  dashboardWindow.loadFile(path.join(__dirname, 'dashboard.html'));

  dashboardWindow.on('closed', () => {
    dashboardWindow = null;
    // Stop watching files when dashboard closes
    Object.values(logWatchers).forEach(watcher => watcher.close());
    logWatchers = {};
  });
}

// Load logs for a specific date
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

// IPC handler for end-of-day response
ipcMain.on('end-of-day-response', (event, choice) => {
  // Close the prompt window
  const window = BrowserWindow.fromWebContents(event.sender);
  if (window) {
    window.close();
  }

  if (choice === 'stop') {
    console.log('User chose to stop tracking');
    stopTracking();
  } else if (choice === '30min') {
    console.log('User chose to continue for 30 more minutes');
    const now = new Date();
    continueUntil = new Date(now.getTime() + 30 * 60 * 1000); // 30 minutes from now
    console.log(`Will ask again at ${continueUntil.toLocaleTimeString()}`);
  } else if (choice === '1hour') {
    console.log('User chose to continue for 1 more hour');
    const now = new Date();
    continueUntil = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour from now
    console.log(`Will ask again at ${continueUntil.toLocaleTimeString()}`);
  }
});

// IPC handler for completing setup
ipcMain.on('complete-setup', async (event, data) => {
  const { startOnBoot } = data;

  // Save settings
  saveSettings({ setupCompleted: true, startOnBoot });

  // Configure auto-launch
  if (startOnBoot) {
    try {
      await autoLauncher.enable();
      console.log('Auto-launch enabled');
    } catch (err) {
      console.error('Failed to enable auto-launch:', err);
    }
  } else {
    try {
      await autoLauncher.disable();
      console.log('Auto-launch disabled');
    } catch (err) {
      console.error('Failed to disable auto-launch:', err);
    }
  }

  // Close setup window
  if (setupWindow) {
    setupWindow.close();
  }

  // Automatically start tracking after setup
  console.log('Setup complete - auto-starting tracking...');
  startTracking();
});

// IPC handler for loading logs
ipcMain.on('load-logs', (event, date) => {
  const data = loadLogsForDate(date);
  event.reply('logs-data', data);

  // Start watching the log files for this date
  watchLogFiles(date);
});

// IPC handler for exporting logs
ipcMain.on('export-logs', (event, date) => {
  const activityFile = path.join(logsDir, `activity_${date}.log`);

  const exportData = {
    date: date,
    activity: ''
  };

  if (fs.existsSync(activityFile)) {
    exportData.activity = fs.readFileSync(activityFile, 'utf-8');
  }

  const exportPath = path.join(logsDir, `export_${date}.json`);
  fs.writeFileSync(exportPath, JSON.stringify(exportData, null, 2));

  event.reply('export-complete', exportPath);
  require('electron').shell.openPath(logsDir);
});

// IPC handler for opening logs folder
ipcMain.on('open-logs-folder', () => {
  require('electron').shell.openPath(logsDir);
});

// IPC handler for opening specific log file
ipcMain.on('open-log-file', (event, data) => {
  if (data.type === 'activity') {
    const filePath = path.join(logsDir, `activity_${data.date}.log`);
    if (fs.existsSync(filePath)) {
      require('electron').shell.openPath(filePath);
    } else {
      require('electron').shell.openPath(logsDir);
    }
  }
});

// IPC handler for loading tracked windows
ipcMain.on('load-tracked-windows', (event) => {
  const data = loadTrackedWindows();
  event.reply('tracked-windows-data', data);
});

// IPC handler for toggling window tracking
ipcMain.on('toggle-window-tracking', (event, data) => {
  const { app, title, isTracked } = data;
  let trackedData = loadTrackedWindows();

  if (isTracked) {
    // Remove from tracked
    trackedData.windows = trackedData.windows.filter(w =>
      !(w.app === app && w.title === title)
    );
  } else {
    // Add to tracked (unassigned by default)
    trackedData.windows.push({ app, title, groupId: null });
  }

  saveTrackedWindows(trackedData.groups, trackedData.windows);
  event.reply('tracked-windows-data', trackedData);
});

// IPC handler for creating a new group
ipcMain.on('create-group', (event, groupName) => {
  const trackedData = loadTrackedWindows();
  const newGroup = {
    id: generateId(),
    name: groupName,
    color: getRandomColor()
  };
  trackedData.groups.push(newGroup);
  saveTrackedWindows(trackedData.groups, trackedData.windows);
  event.reply('tracked-windows-data', trackedData);
});

// IPC handler for renaming a group
ipcMain.on('rename-group', (event, { groupId, newName }) => {
  const trackedData = loadTrackedWindows();
  const group = trackedData.groups.find(g => g.id === groupId);
  if (group) {
    group.name = newName;
    saveTrackedWindows(trackedData.groups, trackedData.windows);
    event.reply('tracked-windows-data', trackedData);
  }
});

// IPC handler for changing group color
ipcMain.on('change-group-color', (event, { groupId, color }) => {
  const trackedData = loadTrackedWindows();
  const group = trackedData.groups.find(g => g.id === groupId);
  if (group) {
    group.color = color;
    saveTrackedWindows(trackedData.groups, trackedData.windows);
    event.reply('tracked-windows-data', trackedData);
  }
});

// IPC handler for deleting a group
ipcMain.on('delete-group', (event, groupId) => {
  const trackedData = loadTrackedWindows();
  // Remove group
  trackedData.groups = trackedData.groups.filter(g => g.id !== groupId);
  // Unassign windows from this group
  trackedData.windows.forEach(w => {
    if (w.groupId === groupId) {
      w.groupId = null;
    }
  });
  saveTrackedWindows(trackedData.groups, trackedData.windows);
  event.reply('tracked-windows-data', trackedData);
});

// IPC handler for assigning window to group
ipcMain.on('assign-window-to-group', (event, { app, title, groupId }) => {
  const trackedData = loadTrackedWindows();
  const window = trackedData.windows.find(w => w.app === app && w.title === title);
  if (window) {
    window.groupId = groupId;
    saveTrackedWindows(trackedData.groups, trackedData.windows);
    event.reply('tracked-windows-data', trackedData);
  }
});

// IPC handler for getting windows list for browse tab
ipcMain.on('get-windows-list', (event, date) => {
  const data = loadLogsForDate(date);
  const windowsWithTime = calculateWindowTime(data.activity);
  const trackedData = loadTrackedWindows();

  // Add tracking status to each window
  const windowsList = windowsWithTime.map(w => ({
    app: w.app,
    title: w.title,
    totalSeconds: w.totalSeconds,
    isTracked: trackedData.windows.some(t => t.app === w.app && t.title === w.title)
  }));

  event.reply('windows-list-data', windowsList);
});

// IPC handler for getting report data
ipcMain.on('get-report', (event, date) => {
  const data = loadLogsForDate(date);
  const windowsWithTime = calculateWindowTime(data.activity);
  const trackedData = loadTrackedWindows();

  // Add group info to tracked windows
  const reportData = windowsWithTime
    .filter(w => trackedData.windows.some(t => t.app === w.app && t.title === w.title))
    .map(w => {
      const trackedWindow = trackedData.windows.find(t => t.app === w.app && t.title === w.title);
      return {
        ...w,
        groupId: trackedWindow ? trackedWindow.groupId : null
      };
    });

  event.reply('report-data', { windows: reportData, groups: trackedData.groups });
});

// Ask user if they want to continue tracking after 5pm
function askToContinueTracking() {
  const promptWindow = new BrowserWindow({
    width: 450,
    height: 300,
    resizable: false,
    frame: true,
    alwaysOnTop: true,
    title: 'Cascayd TimeTracker',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  const promptHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      margin: 0;
      padding: 30px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100vh;
      box-sizing: border-box;
      background: #f5f5f5;
    }
    .container {
      text-align: center;
      background: white;
      padding: 30px;
      border-radius: 10px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      width: 100%;
    }
    h2 {
      margin: 0 0 10px 0;
      color: #333;
      font-size: 20px;
    }
    p {
      margin: 0 0 25px 0;
      color: #666;
      font-size: 14px;
    }
    .buttons {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    button {
      padding: 12px 20px;
      font-size: 14px;
      font-weight: 600;
      border: none;
      border-radius: 5px;
      cursor: pointer;
      transition: all 0.2s;
    }
    .continue-btn {
      background: #10b981;
      color: white;
    }
    .continue-btn:hover {
      background: #059669;
    }
    .stop-btn {
      background: #ef4444;
      color: white;
    }
    .stop-btn:hover {
      background: #dc2626;
    }
  </style>
</head>
<body>
  <div class="container">
    <h2>End of Day - 5:00 PM</h2>
    <p>It's 5pm! Do you want to continue tracking?</p>
    <div class="buttons">
      <button class="continue-btn" onclick="respond('30min')">Continue 30 more minutes</button>
      <button class="continue-btn" onclick="respond('1hour')">Continue 1 more hour</button>
      <button class="stop-btn" onclick="respond('stop')">Stop tracking</button>
    </div>
  </div>

  <script>
    const { ipcRenderer } = require('electron');

    function respond(choice) {
      ipcRenderer.send('end-of-day-response', choice);
    }
  </script>
</body>
</html>
  `;

  promptWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(promptHtml));
}

// Check if it's time to ask about continuing (5pm or after extension expires)
function checkEndOfDay() {
  // Only check if we're actively tracking
  if (!windowTrackInterval) {
    return;
  }

  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();

  // Check if we should ask due to extension expiring
  if (continueUntil && now >= continueUntil) {
    console.log('Extension expired, asking if user wants to continue');
    continueUntil = null;
    askToContinueTracking();
    return;
  }

  // Check if it's 5pm and we haven't asked today
  if (currentHour === END_OF_DAY_HOUR && currentMinute === END_OF_DAY_MINUTE && !hasAskedTodayAt5pm) {
    console.log('It\'s 5pm, asking if user wants to continue tracking');
    hasAskedTodayAt5pm = true;
    askToContinueTracking();
  }

  // Reset the flag at midnight
  if (currentHour === 0 && currentMinute === 0) {
    hasAskedTodayAt5pm = false;
    continueUntil = null;
  }
}

// Start tracking windows
async function startTracking() {
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
    endOfDayCheckInterval = setInterval(checkEndOfDay, 60 * 1000); // Check every minute
  }

  // Update tray tooltip
  if (tray) {
    tray.setToolTip('Tracking window activity...');
  }

  // Update tray menu to show "Stop Tracking" option
  if (global.updateTrayMenu) {
    global.updateTrayMenu();
  }
}

// Stop tracking windows
function stopTracking() {
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

  // Update tray tooltip
  if (tray) {
    tray.setToolTip('Cascayd TimeTracker (not tracking)');
  }

  // Update tray menu to show "Start Tracking" option
  if (global.updateTrayMenu) {
    global.updateTrayMenu();
  }

  // Log that tracking stopped
  const timestamp = new Date().toISOString();
  const logEntry = `${timestamp} | SYSTEM | Tracking stopped by user\n`;
  const logFile = getTodayLogFile();
  fs.appendFileSync(logFile, logEntry);
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

      lastWindowTitle = title;
      lastWindowOwner = owner;
    }
  } catch (error) {
    console.error('[TRACK] ERROR:', error);
  }
}

function createTray() {
  // Create a proper 16x16 icon for Windows
  const canvas = require('electron').nativeImage.createEmpty();
  const size = { width: 16, height: 16 };

  // Try creating from data URL
  const iconData = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAAdgAAAHYBTnsmCAAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAADfSURBVDiNpdLBSsNAFIXh78YkJtEupYtCQRBcuHLrC/gGvoBv4M6tK3fiC/gCvoBv4M6tK3fiC/gGigiCBBeuXLlw4cKFC1cKLly4cuHChQsXrlwoXLhw5cKFCxcuXChcuHDlwoULFy5cKFy4cOXChQsXLlwoXLhw5cKFCxcuXChcuHDlwoULFy5cKFy4cOXChQsXLlwoXLhw5cKFCxcuXChcuHDlwoULFy5cKFy4cOXChQsXLlwoXLhw5cKFCxcuXChcuHDlwoULFy5cKFy4cOXChQsXLhwpcOHClQsXDlwAeH8pFfBnqcAAAAAASUVORK5CYII=';
  const icon = nativeImage.createFromDataURL(iconData);

  tray = new Tray(icon);

  tray.setToolTip('Tracking window activity...');

  // Open dashboard on tray click
  tray.on('click', () => {
    openDashboard();
  });

  // Build context menu
  const buildContextMenu = async () => {
    const settings = loadSettings();
    const isAutoLaunchEnabled = await autoLauncher.isEnabled().catch(() => false);
    const isTracking = windowTrackInterval !== null;

    const menuItems = [
      {
        label: 'Open Dashboard',
        click: () => openDashboard()
      },
      { type: 'separator' }
    ];

    // Show either Start or Stop tracking based on current state
    if (isTracking) {
      menuItems.push({
        label: 'Stop Tracking',
        click: () => stopTracking()
      });
    } else {
      menuItems.push({
        label: 'Start Tracking Now',
        click: () => startTracking()
      });
    }

    menuItems.push(
      { type: 'separator' },
      {
        label: 'Start on Login',
        type: 'checkbox',
        checked: isAutoLaunchEnabled,
        click: async (menuItem) => {
          if (menuItem.checked) {
            await autoLauncher.enable();
            settings.startOnBoot = true;
          } else {
            await autoLauncher.disable();
            settings.startOnBoot = false;
          }
          saveSettings(settings);
          tray.setContextMenu(await buildContextMenu());
        }
      },
      { type: 'separator' },
      {
        label: 'Open Logs Folder',
        click: () => require('electron').shell.openPath(logsDir)
      },
      { type: 'separator' },
      {
        label: 'Test 5pm Dialog',
        click: () => askToContinueTracking()
      },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => app.quit()
      }
    );

    return Menu.buildFromTemplate(menuItems);
  };

  // Set initial context menu
  buildContextMenu().then(menu => tray.setContextMenu(menu));

  // Expose buildContextMenu globally so we can refresh it
  global.updateTrayMenu = () => {
    buildContextMenu().then(menu => tray.setContextMenu(menu));
  };
}

app.whenReady().then(async () => {
  // Create a hidden window (required for Electron to stay running)
  mainWindow = new BrowserWindow({
    width: 1,
    height: 1,
    show: false,
    skipTaskbar: true,
    webPreferences: {
      nodeIntegration: true
    }
  });

  // Prevent app from showing in dock (Mac)
  if (app.dock) {
    app.dock.hide();
  }

  createTray();

  console.log(`TimeTracker started.`);

  // Check for updates
  autoUpdater.checkForUpdatesAndNotify();

  // Auto-updater event handlers
  autoUpdater.on('update-available', (info) => {
    console.log('Update available:', info.version);
  });

  autoUpdater.on('update-downloaded', (info) => {
    console.log('Update downloaded:', info.version);

    // Show dialog to install update
    const { dialog } = require('electron');
    dialog.showMessageBox({
      type: 'info',
      title: 'Update Ready',
      message: `Version ${info.version} has been downloaded`,
      detail: 'The update will be installed when you restart the app. Would you like to restart now?',
      buttons: ['Restart Now', 'Later'],
      defaultId: 0
    }).then((result) => {
      if (result.response === 0) {
        // User clicked "Restart Now"
        autoUpdater.quitAndInstall(false, true);
      }
    });
  });

  autoUpdater.on('error', (err) => {
    console.error('Auto-updater error:', err);
  });

  // Check if this is the first run
  if (isFirstRun()) {
    console.log('First run detected - showing setup window');
    openSetupWindow();
  } else {
    // Not first run - automatically start tracking
    console.log('Auto-starting tracking...');
    startTracking();
  }
});

app.on('window-all-closed', () => {
  // Don't quit - we run in background with tray
  // Do nothing
});

app.on('before-quit', () => {
  if (windowTrackInterval) {
    clearInterval(windowTrackInterval);
  }
  if (endOfDayCheckInterval) {
    clearInterval(endOfDayCheckInterval);
  }
});
