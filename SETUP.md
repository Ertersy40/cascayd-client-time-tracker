# Cascayd TimeTracker Setup

## For Building (Your Machine)

1. Install electron-builder:
```bash
npm install
```

2. Build the app:
```bash
npm run build
```

3. The installer will be in `dist/` folder
   - Windows: `Cascayd TimeTracker Setup X.X.X.exe`
   - Mac: `Cascayd TimeTracker-X.X.X.dmg`

## For Your Cofounder

1. Install the app from the installer you send them
2. Run the app - it will appear in the system tray

That's it! AWS credentials are bundled in the app.

## What It Does

- Takes screenshots every 2 minutes
- Uses Claude Sonnet 4.5 to detect if you're doing client work
- Identifies which client you're working on
- Deletes screenshots immediately after analysis (no storage)
- Tracks active windows every 5 seconds
- Logs saved to: `%APPDATA%\Cascayd TimeTracker\logs\` (Windows) or `~/Library/Application Support/Cascayd TimeTracker/logs/` (Mac)

## Tray Menu

- **Click tray icon**: Opens dashboard
- **Open Logs Folder**: View log files
- **Quit**: Close the app

## Dashboard

The dashboard has 3 tabs:

**Overview:**
- Total client work time today
- Time breakdown by client
- Time breakdown by app

**Details:**
- Timeline of all client work sessions with descriptions
- Window activity log

**Settings:**
- Configure clients (business names and key contacts)
- Edit AI prompt for categorization
