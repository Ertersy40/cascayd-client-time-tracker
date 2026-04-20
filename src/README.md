# Source Code Structure

This directory contains the modularized source code for the Cascayd TimeTracker application.

## Module Overview

### `main.js`
**Entry point** for the Electron application. Handles app initialization, lifecycle events, and coordinates all other modules.

### `config.js`
**Configuration and constants** - Contains all application constants (idle thresholds, end-of-day times, color palettes), file paths, and ensures necessary directories exist.

### `settings.js`
**Settings management** - Handles loading, saving, and checking app settings including first-run detection.

### `trackedWindows.js`
**Window tracking data** - Manages the list of tracked windows and groups, including CRUD operations and utility functions for IDs and colors.

### `timeCalculation.js`
**Time calculation utilities** - Calculates time spent per window from activity logs, handling gaps and edge cases.

### `logManager.js`
**Log file operations** - Handles reading/writing activity logs, file watching for live updates, and log file management.

### `windowManager.js`
**Window management** - Creates and manages Electron BrowserWindows (setup window, dashboard window).

### `tracking.js`
**Core tracking functionality** - Implements the active window tracking loop, idle detection, and start/stop controls.

### `tray.js`
**System tray management** - Creates the system tray icon and builds the context menu with dynamic state.

### `endOfDay.js`
**End-of-day prompts** - Handles the 5pm dialog asking users if they want to continue tracking, including extension timers.

### `updater.js`
**Auto-update logic** - Configures electron-updater and handles update notifications.

### `ipcHandlers.js`
**IPC communication** - Registers all IPC handlers for communication between main and renderer processes.

## Benefits of This Structure

1. **Separation of Concerns** - Each module has a single, well-defined responsibility
2. **Easier Testing** - Individual modules can be tested in isolation
3. **Better Maintainability** - Finding and fixing bugs is easier when code is organized
4. **Improved Readability** - Each file is focused and comprehensible
5. **Reusability** - Modules can be reused across different parts of the app

## Import Pattern

All modules export their public functions/data:

```javascript
const { functionName } = require('./moduleName');
```

And the main.js orchestrates them all together.
