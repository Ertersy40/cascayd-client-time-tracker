const { BrowserWindow } = require('electron');
const { END_OF_DAY_HOUR, END_OF_DAY_MINUTE } = require('./config');

let hasAskedTodayAt5pm = false;
let continueUntil = null;

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

function checkEndOfDay(isTracking, stopTrackingCallback) {
  // Only check if we're actively tracking
  if (!isTracking) {
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

function handleEndOfDayResponse(choice, stopTrackingCallback) {
  if (choice === 'stop') {
    console.log('User chose to stop tracking');
    stopTrackingCallback();
  } else if (choice === '30min') {
    console.log('User chose to continue for 30 more minutes');
    const now = new Date();
    continueUntil = new Date(now.getTime() + 30 * 60 * 1000);
    console.log(`Will ask again at ${continueUntil.toLocaleTimeString()}`);
  } else if (choice === '1hour') {
    console.log('User chose to continue for 1 more hour');
    const now = new Date();
    continueUntil = new Date(now.getTime() + 60 * 60 * 1000);
    console.log(`Will ask again at ${continueUntil.toLocaleTimeString()}`);
  }
}

module.exports = {
  askToContinueTracking,
  checkEndOfDay,
  handleEndOfDayResponse
};
