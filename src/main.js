const { app, BrowserWindow } = require('electron');
const path = require('path');
const AutoLaunch = require('auto-launch');
const { isFirstRun, loadSettings, saveSettings } = require('./settings');
const { openSetupWindow, openDashboard, closeSetupWindow } = require('./windowManager');
const { startTracking, stopTracking, isTracking } = require('./tracking');
const { createTray } = require('./tray');
const { setupAutoUpdater } = require('./updater');
const { registerIpcHandlers } = require('./ipcHandlers');
const { checkEndOfDay, handleEndOfDayResponse } = require('./endOfDay');
const { startSync, stopSync } = require('./supabase');

// Prevent any window from showing
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('no-sandbox');

let mainWindow = null;
let updateTrayMenu = null;

// Auto-launch configuration
// When packaged, exe path points to the app itself. When running in dev,
// exe path is electron.exe so we need to pass the project dir as an arg.
const autoLaunchOptions = { name: 'Cascayd TimeTracker' };
if (app.isPackaged) {
  autoLaunchOptions.path = app.getPath('exe');
} else {
  autoLaunchOptions.path = process.execPath; // electron.exe
  autoLaunchOptions.args = [path.resolve(process.argv[1] || '.')];
}
const autoLauncher = new AutoLaunch(autoLaunchOptions);

// Setup complete callback
async function handleSetupComplete(data) {
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
  closeSetupWindow();

  // Automatically start tracking after setup
  console.log('Setup complete - auto-starting tracking...');
  await startTracking(updateTrayMenu, () => checkEndOfDay(isTracking(), handleStopTracking));
}

// End of day response callback
function onEndOfDayResponse(choice) {
  handleEndOfDayResponse(choice, handleStopTracking);
}

// Tracking callbacks
async function handleStartTracking() {
  await startTracking(updateTrayMenu, () => checkEndOfDay(isTracking(), handleStopTracking));
}

function handleStopTracking() {
  stopTracking(updateTrayMenu);
}

// Register IPC handlers
registerIpcHandlers(handleSetupComplete, onEndOfDayResponse);

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

  // Create tray
  updateTrayMenu = createTray(
    app,
    autoLauncher,
    handleStartTracking,
    handleStopTracking,
    openDashboard,
    isTracking
  );

  console.log(`TimeTracker started.`);

  // Start hourly Supabase sync
  startSync();

  // Setup auto-updater
  setupAutoUpdater();

  // Check if this is the first run
  if (isFirstRun()) {
    console.log('First run detected - showing setup window');
    openSetupWindow();
  } else {
    // Not first run - automatically start tracking
    console.log('Auto-starting tracking...');
    await startTracking(updateTrayMenu, () => checkEndOfDay(isTracking(), handleStopTracking));
  }
});

app.on('window-all-closed', () => {
  // Don't quit - we run in background with tray
});

app.on('before-quit', async () => {
  // Flush any remaining entries to Supabase before exit
  await stopSync();
});
