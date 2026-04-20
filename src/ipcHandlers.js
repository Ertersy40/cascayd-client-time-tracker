const { ipcMain, BrowserWindow, shell } = require('electron');
const fs = require('fs');
const path = require('path');
const { logsDir } = require('./config');
const { loadLogsForDate, watchLogFiles } = require('./logManager');
const { calculateWindowTime } = require('./timeCalculation');
const {
  loadTrackedWindows,
  saveTrackedWindows,
  getRandomColor,
  generateId
} = require('./trackedWindows');
const { getDashboardWindow } = require('./windowManager');

function registerIpcHandlers(setupCompleteCallback, endOfDayResponseCallback) {
  // IPC handler for completing setup
  ipcMain.on('complete-setup', (event, data) => {
    setupCompleteCallback(data);
  });

  // IPC handler for end-of-day response
  ipcMain.on('end-of-day-response', (event, choice) => {
    // Close the prompt window
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window) {
      window.close();
    }
    endOfDayResponseCallback(choice);
  });

  // IPC handler for loading logs
  ipcMain.on('load-logs', (event, date) => {
    const data = loadLogsForDate(date);
    event.reply('logs-data', data);

    // Start watching the log files for this date
    const dashboardWindow = getDashboardWindow();
    watchLogFiles(date, dashboardWindow);
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
    shell.openPath(logsDir);
  });

  // IPC handler for opening logs folder
  ipcMain.on('open-logs-folder', () => {
    shell.openPath(logsDir);
  });

  // IPC handler for opening specific log file
  ipcMain.on('open-log-file', (event, data) => {
    if (data.type === 'activity') {
      const filePath = path.join(logsDir, `activity_${data.date}.log`);
      if (fs.existsSync(filePath)) {
        shell.openPath(filePath);
      } else {
        shell.openPath(logsDir);
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
}

module.exports = {
  registerIpcHandlers
};
