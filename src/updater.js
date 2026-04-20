const { autoUpdater } = require('electron-updater');
const { dialog } = require('electron');

function setupAutoUpdater() {
  // Check for updates
  autoUpdater.checkForUpdatesAndNotify();

  // Auto-updater event handlers
  autoUpdater.on('update-available', (info) => {
    console.log('Update available:', info.version);
  });

  autoUpdater.on('update-downloaded', (info) => {
    console.log('Update downloaded:', info.version);

    // Show dialog to install update
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
}

module.exports = {
  setupAutoUpdater
};
