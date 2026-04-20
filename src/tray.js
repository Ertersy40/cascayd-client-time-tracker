const { Tray, Menu, nativeImage, shell } = require('electron');
const { logsDir } = require('./config');
const { loadSettings, saveSettings } = require('./settings');
const { askToContinueTracking } = require('./endOfDay');

let tray = null;

function createTray(app, autoLauncher, startTrackingCallback, stopTrackingCallback, openDashboardCallback, isTrackingCallback) {
  // Create a proper 16x16 icon for Windows
  const iconData = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAAdgAAAHYBTnsmCAAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAADfSURBVDiNpdLBSsNAFIXh78YkJtEupYtCQRBcuHLrC/gGvoBv4M6tK3fiC/gCvoBv4M6tK3fiC/gGigiCBBeuXLlw4cKFC1cKLly4cuHChQsXrlwoXLhw5cKFCxcuXChcuHDlwoULFy5cKFy4cOXChQsXLlwoXLhw5cKFCxcuXChcuHDlwoULFy5cKFy4cOXChQsXLlwoXLhw5cKFCxcuXChcuHDlwoULFy5cKFy4cOXChQsXLlwoXLhw5cKFCxcuXChcuHDlwoULFy5cKFy4cOXChQsXLhwpcOHClQsXDlwAeH8pFfBnqcAAAAAASUVORK5CYII=';
  const icon = nativeImage.createFromDataURL(iconData);

  tray = new Tray(icon);
  tray.setToolTip('Cascayd TimeTracker');

  // Open dashboard on tray click
  tray.on('click', () => {
    openDashboardCallback();
  });

  // Build context menu
  const buildContextMenu = async () => {
    const settings = loadSettings();
    const isAutoLaunchEnabled = await autoLauncher.isEnabled().catch(() => false);
    const isTracking = isTrackingCallback();

    const menuItems = [
      {
        label: 'Open Dashboard',
        click: () => openDashboardCallback()
      },
      { type: 'separator' }
    ];

    // Show either Start or Stop tracking based on current state
    if (isTracking) {
      menuItems.push({
        label: 'Stop Tracking',
        click: () => stopTrackingCallback()
      });
    } else {
      menuItems.push({
        label: 'Start Tracking Now',
        click: () => startTrackingCallback()
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
        click: () => shell.openPath(logsDir)
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

  // Return update function
  return () => {
    buildContextMenu().then(menu => tray.setContextMenu(menu));

    const isTracking = isTrackingCallback();
    if (isTracking) {
      tray.setToolTip('Tracking window activity...');
    } else {
      tray.setToolTip('Cascayd TimeTracker (not tracking)');
    }
  };
}

module.exports = {
  createTray
};
