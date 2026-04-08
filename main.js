const { app, Tray, Menu, nativeImage, BrowserWindow, ipcMain } = require('electron');
const { autoUpdater } = require('electron-updater');
const fs = require('fs');
const path = require('path');
const desktopIdle = require('desktop-idle');

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
let lastWindowTitle = '';
let lastWindowOwner = '';
let activeWin = null;
let logWatchers = {}; // File watchers for log files
let updateTimeout = null; // Debounce file watcher updates
let wasInactive = false; // Track if user was inactive in previous check

// Inactivity threshold in seconds (10 seconds for testing)
const IDLE_THRESHOLD = 10;

// Create logs directory
const logsDir = path.join(app.getPath('userData'), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Tracked windows file
const trackedWindowsPath = path.join(app.getPath('userData'), 'tracked_windows.json');

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

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open Dashboard',
      click: () => openDashboard()
    },
    { type: 'separator' },
    {
      label: 'Open Logs Folder',
      click: () => require('electron').shell.openPath(logsDir)
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => app.quit()
    }
  ]);

  tray.setContextMenu(contextMenu);
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
  autoUpdater.on('update-available', () => {
    console.log('Update available');
  });

  autoUpdater.on('update-downloaded', () => {
    console.log('Update downloaded');
    if (tray) {
      tray.displayBalloon({
        title: 'Update Ready',
        content: 'Restart cascayd to apply the update'
      });
    }
  });

  // Dynamically import active-win (ES module) - do this AFTER window setup
  const activeWinModule = await import('active-win');
  activeWin = activeWinModule.activeWindow || activeWinModule.default;

  // NOW start tracking windows every 10 seconds (for testing)
  trackActiveWindow();
  windowTrackInterval = setInterval(trackActiveWindow, 10 * 1000);
});

app.on('window-all-closed', () => {
  // Don't quit - we run in background with tray
  // Do nothing
});

app.on('before-quit', () => {
  if (windowTrackInterval) {
    clearInterval(windowTrackInterval);
  }
});
