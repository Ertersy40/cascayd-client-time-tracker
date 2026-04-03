const { app, desktopCapturer, Tray, Menu, nativeImage, BrowserWindow, ipcMain } = require('electron');
const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');
const { autoUpdater } = require('electron-updater');
const fs = require('fs');
const path = require('path');

// Load .env from app directory (works in dev and when packaged)
const envPath = path.join(__dirname, '.env');
require('dotenv').config({ path: envPath });

// Prevent any window from showing
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('no-sandbox');

let tray = null;
let captureInterval = null;
let windowTrackInterval = null;
let captureCount = 0;
let clientWorkCount = 0;
let mainWindow = null;
let dashboardWindow = null;
let lastWindowTitle = '';
let lastWindowOwner = '';
let activeWin = null;
let recentWindows = []; // Track windows since last screenshot
let logWatchers = {}; // File watchers for log files
let updateTimeout = null; // Debounce file watcher updates

// Create screenshots directory
const screenshotsDir = path.join(app.getPath('userData'), 'screenshots');
if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

// Create logs directory
const logsDir = path.join(app.getPath('userData'), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// AWS Bedrock client
const bedrockClient = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

// Load categorization prompt
const promptPath = path.join(__dirname, 'categorization-prompt.txt');
let categorizationPrompt = 'Categorize this screenshot as SALES, CLIENT, PRODUCT, or OPS';
if (fs.existsSync(promptPath)) {
  categorizationPrompt = fs.readFileSync(promptPath, 'utf-8');
}

// Load clients configuration
const clientsPath = path.join(app.getPath('userData'), 'clients.json');
let clients = [];
function loadClients() {
  if (fs.existsSync(clientsPath)) {
    try {
      clients = JSON.parse(fs.readFileSync(clientsPath, 'utf-8'));
    } catch (e) {
      clients = [];
    }
  }
  return clients;
}
loadClients();

// Get today's log file
function getTodayLogFile() {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  return path.join(logsDir, `activity_${today}.log`);
}

// Get today's categories log file
function getTodayCategoriesLogFile() {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  return path.join(logsDir, `categories_${today}.log`);
}

// Watch log files for changes
function watchLogFiles(date) {
  // Stop watching old files
  Object.values(logWatchers).forEach(watcher => watcher.close());
  logWatchers = {};

  const activityFile = path.join(logsDir, `activity_${date}.log`);
  const categoriesFile = path.join(logsDir, `categories_${date}.log`);

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

  // Watch categories log (create if doesn't exist)
  if (!fs.existsSync(categoriesFile)) {
    fs.writeFileSync(categoriesFile, '');
  }
  logWatchers.categories = fs.watch(categoriesFile, (eventType) => {
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
  const categoriesFile = path.join(logsDir, `categories_${date}.log`);

  const activity = [];
  const categories = [];

  // Parse activity log
  if (fs.existsSync(activityFile)) {
    const content = fs.readFileSync(activityFile, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());

    lines.forEach(line => {
      const parts = line.split(' | ');
      if (parts.length >= 3) {
        const timestamp = parts[0];
        const time = new Date(timestamp).toLocaleTimeString();
        activity.push({
          time: time,
          timestamp: timestamp,
          app: parts[1],
          title: parts[2]
        });
      }
    });
  }

  // Parse categories log
  if (fs.existsSync(categoriesFile)) {
    const content = fs.readFileSync(categoriesFile, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());

    lines.forEach(line => {
      const parts = line.split(' | ');
      if (parts.length >= 3) {
        const timestamp = parts[0];
        const time = new Date(timestamp).toLocaleTimeString();
        const description = parts[1];
        const client = parts[2];
        categories.push({
          time: time,
          description: description,
          client: client
        });
      }
    });
  }

  return { activity, categories };
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
  const categoriesFile = path.join(logsDir, `categories_${date}.log`);

  const exportData = {
    date: date,
    activity: [],
    categories: []
  };

  if (fs.existsSync(activityFile)) {
    exportData.activity = fs.readFileSync(activityFile, 'utf-8');
  }

  if (fs.existsSync(categoriesFile)) {
    exportData.categories = fs.readFileSync(categoriesFile, 'utf-8');
  }

  const exportPath = path.join(logsDir, `export_${date}.json`);
  fs.writeFileSync(exportPath, JSON.stringify(exportData, null, 2));

  event.reply('export-complete', exportPath);
  require('electron').shell.openPath(logsDir);
});

// IPC handler for loading prompt
ipcMain.on('load-prompt', (event) => {
  event.reply('prompt-data', categorizationPrompt);
});

// IPC handler for saving prompt
ipcMain.on('save-prompt', (event, newPrompt) => {
  categorizationPrompt = newPrompt;
  fs.writeFileSync(promptPath, newPrompt, 'utf-8');
  event.reply('prompt-saved');
});

// IPC handler for loading clients
ipcMain.on('load-clients', (event) => {
  loadClients();
  event.reply('clients-data', clients);
});

// IPC handler for saving clients
ipcMain.on('save-clients', (event, newClients) => {
  clients = newClients;
  fs.writeFileSync(clientsPath, JSON.stringify(clients, null, 2));
});

// IPC handler for opening logs folder
ipcMain.on('open-logs-folder', () => {
  require('electron').shell.openPath(logsDir);
});

// IPC handler for opening specific log file
ipcMain.on('open-log-file', (event, data) => {
  let filePath;
  if (data.type === 'categories') {
    filePath = path.join(logsDir, `categories_${data.date}.log`);
  } else if (data.type === 'activity') {
    filePath = path.join(logsDir, `activity_${data.date}.log`);
  }

  if (filePath && fs.existsSync(filePath)) {
    require('electron').shell.openPath(filePath);
  } else {
    // If file doesn't exist, just open the folder
    require('electron').shell.openPath(logsDir);
  }
});

// Categorize screenshot using AWS Bedrock
async function categorizeScreenshot(screenshotPath) {
  try {
    // Read the image file
    const imageBuffer = fs.readFileSync(screenshotPath);
    const base64Image = imageBuffer.toString('base64');

    // Build context from recent windows
    let windowContext = '';
    if (recentWindows.length > 0) {
      windowContext = '\n\nACTIVE WINDOWS SINCE LAST SCREENSHOT:\n';
      recentWindows.forEach(w => {
        windowContext += `- ${w.app}: ${w.title}\n`;
      });
      windowContext += '\n';
    }

    // Build client context
    let clientContext = '';
    if (clients.length > 0) {
      clientContext = '\n\nCONFIGURED CLIENTS:\n';
      clients.forEach(client => {
        if (client.business) {
          clientContext += `- ${client.business}`;
          if (client.people) {
            clientContext += ` (contacts: ${client.people})`;
          }
          clientContext += '\n';
        }
      });
      clientContext += '\nIf you see any of these business names or people in emails, Slack, analytics tools, or internal discussions about them, it counts as CLIENT work.\n';
    }

    // Prepare the request for Claude Sonnet 4.5
    const payload = {
      anthropic_version: "bedrock-2023-05-31",
      max_tokens: 150,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: "image/png",
                data: base64Image
              }
            },
            {
              type: "text",
              text: clientContext + windowContext + categorizationPrompt
            }
          ]
        }
      ]
    };

    const command = new InvokeModelCommand({
      modelId: "us.anthropic.claude-sonnet-4-5-20250929-v1:0",
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify(payload)
    });

    const response = await bedrockClient.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    const fullOutput = responseBody.content[0].text.trim();

    // Extract the last line as the category
    const lines = fullOutput.split('\n').filter(line => line.trim());
    const categoryLine = lines[lines.length - 1].trim().toUpperCase();
    const description = lines.slice(0, -1).join('\n').trim();

    // Parse category and client name
    let category = 'SKIP';
    let clientName = '';

    if (categoryLine.startsWith('CLIENT')) {
      category = 'CLIENT';
      // Extract client name if present (format: "CLIENT: ClientName")
      const colonIndex = categoryLine.indexOf(':');
      if (colonIndex !== -1) {
        clientName = categoryLine.substring(colonIndex + 1).trim();
      }
    }

    console.log(`[CATEGORIZE] Description: "${description}"`);
    console.log(`[CATEGORIZE] Category: ${category}`);
    if (clientName) {
      console.log(`[CATEGORIZE] Client: ${clientName}`);
    }

    // Only log if it's CLIENT work
    if (category === 'CLIENT') {
      const timestamp = new Date().toISOString();
      const logEntry = `${timestamp} | ${description} | ${clientName || 'Unknown'}\n`;
      const categoriesLogFile = getTodayCategoriesLogFile();
      fs.appendFileSync(categoriesLogFile, logEntry);

      clientWorkCount++;

      // Update tray tooltip with client work time
      if (tray) {
        const clientMinutes = clientWorkCount * 2;
        const hours = Math.floor(clientMinutes / 60);
        const mins = clientMinutes % 60;
        const timeStr = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
        tray.setToolTip(`Client Work: ${timeStr}\nLast logged: ${new Date().toLocaleTimeString()}`);
      }
    } else {
      console.log(`[CATEGORIZE] Skipping - not client work`);
    }

    // Clear recent windows after categorization
    recentWindows = [];

    return category;
  } catch (error) {
    console.error('[CATEGORIZE] ERROR:', error.message);
    return 'ERROR';
  }
}

async function trackActiveWindow() {
  try {
    if (!activeWin) return;

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

      // Add to recent windows for AI context
      recentWindows.push({ app: owner, title: title });

      lastWindowTitle = title;
      lastWindowOwner = owner;
    }
  } catch (error) {
    console.error('[TRACK] ERROR:', error);
  }
}

async function captureScreens() {
  try {
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: 1920, height: 1080 }
    });

    const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
    const savedFiles = [];

    for (let i = 0; i < sources.length; i++) {
      const source = sources[i];
      const filename = `${timestamp}_screen${i + 1}.png`;
      const filepath = path.join(screenshotsDir, filename);

      const buffer = source.thumbnail.toPNG();
      fs.writeFileSync(filepath, buffer);
      savedFiles.push(filepath);
    }

    captureCount++;

    // Categorize the first screenshot (assuming primary monitor), then delete
    if (savedFiles.length > 0) {
      await categorizeScreenshot(savedFiles[0]);

      // Delete all screenshots after categorization
      for (const filepath of savedFiles) {
        try {
          fs.unlinkSync(filepath);
        } catch (err) {
          console.error(`[DELETE] Failed to delete ${filepath}:`, err.message);
        }
      }
    }
  } catch (error) {
    console.error('Capture error:', error);
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

  tray.setToolTip('Tracking client work...');

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

  // Capture immediately on start
  captureScreens();

  // Then capture every 2 minutes
  captureInterval = setInterval(captureScreens, 120 * 1000);

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

  // NOW start tracking windows
  trackActiveWindow();
  windowTrackInterval = setInterval(trackActiveWindow, 5 * 1000);
});

app.on('window-all-closed', () => {
  // Don't quit - we run in background with tray
  // Do nothing
});

app.on('before-quit', () => {
  if (captureInterval) {
    clearInterval(captureInterval);
  }
  if (windowTrackInterval) {
    clearInterval(windowTrackInterval);
  }
});
