const { BrowserWindow } = require('electron');
const path = require('path');
const { closeLogWatchers } = require('./logManager');

let setupWindow = null;
let dashboardWindow = null;

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

  return setupWindow;
}

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

  dashboardWindow.loadFile(path.join(__dirname, '..', 'dashboard.html'));

  dashboardWindow.on('closed', () => {
    dashboardWindow = null;
    // Stop watching files when dashboard closes
    closeLogWatchers();
  });

  return dashboardWindow;
}

function getSetupWindow() {
  return setupWindow;
}

function getDashboardWindow() {
  return dashboardWindow;
}

function closeSetupWindow() {
  if (setupWindow) {
    setupWindow.close();
    setupWindow = null;
  }
}

module.exports = {
  openSetupWindow,
  openDashboard,
  getSetupWindow,
  getDashboardWindow,
  closeSetupWindow
};
