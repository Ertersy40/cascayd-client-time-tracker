# Cascayd TimeTracker Setup

## Windows Setup Requirements

This project uses `desktop-idle`, a native Node module that requires C++ compilation on Windows.

**If using Node v22+, you MUST install Visual Studio Build Tools:**

1. Download [Visual Studio Build Tools 2022](https://visualstudio.microsoft.com/downloads/#build-tools-for-visual-studio-2022)
2. Run the installer
3. Select **"Desktop development with C++"** workload
4. Install (requires ~7GB disk space)
5. Restart your terminal
6. Run `npm install`

**Why this is needed:** Node v22 requires VS 2022 Build Tools to compile native modules. Without this, `npm install` will fail and electron won't be installed, causing `npm start` to fail with "electron is not recognized".

## For Building & Releasing

See **RELEASE.md** for the full auto-update workflow.

**Quick Start:**
```bash
npm install                 # Install dependencies
npm run build              # Build installer (local only)
npm run release            # Build and publish update to GitHub
```

The installer will be in `dist/` folder:
- Windows: `Cascayd TimeTracker Setup X.X.X.exe`
- Mac: `Cascayd TimeTracker-X.X.X.dmg`

## For Your Cofounder

1. Install the app from the installer you send them (first time only!)
2. Run the app - a welcome screen will appear
3. Choose whether to start on login (recommended)
4. Click "Get Started"
5. The app automatically starts tracking and appears in the system tray

**That's it!** 
- AWS credentials are bundled in the app
- **Future updates install automatically** - no need to reinstall!

## First Run Setup

The first time you run the app, you'll see a welcome screen that:
- Explains what the app does
- Asks if you want it to start automatically when you log in
- Lets you get started with one click

After setup, the app automatically starts tracking every time it launches. No extra prompts or confirmations needed!

## What It Does

- Tracks active windows every 10 seconds
- Detects user inactivity automatically (idle detection)
- Organizes windows into custom groups for reporting
- **End-of-day reminder at 5:00 PM** - asks if you want to continue tracking with options for 30 min or 1 hour extensions
- **Automatic updates** - checks for new versions on startup and installs them automatically
- Privacy-focused: all data stored locally
- Logs saved to: `%APPDATA%\Cascayd TimeTracker\logs\` (Windows) or `~/Library/Application Support/Cascayd TimeTracker/logs/` (Mac)

## Tray Menu

- **Click tray icon**: Opens dashboard
- **Open Dashboard**: Opens the dashboard window
- **Start Tracking Now** / **Stop Tracking**: Start or stop tracking (toggles based on current state)
- **Start on Login**: Toggle auto-start on Windows/Mac login (checkbox)
- **Open Logs Folder**: View log files
- **Quit**: Close the app

## End-of-Day Feature

At 5:00 PM every day, the app will show a dialog asking if you want to continue tracking with three options:
- **Continue 30 more minutes** - Tracking continues, and you'll be asked again in 30 minutes
- **Continue 1 more hour** - Tracking continues, and you'll be asked again in 1 hour
- **Stop tracking** - Tracking stops for the day

You can always manually restart tracking from the tray menu.

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
