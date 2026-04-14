# How to Release Updates

## Automatic Update System

The app uses **electron-updater** to automatically download and install updates from GitHub Releases. Users will be notified when an update is available.

## Prerequisites

1. **GitHub Token**: You need a GitHub Personal Access Token with `repo` permissions
   - Go to: https://github.com/settings/tokens
   - Click "Generate new token (classic)"
   - Select `repo` scope
   - Copy the token

2. **Set Environment Variable**:
   ```bash
   # Windows (PowerShell)
   $env:GH_TOKEN="your_github_token_here"
   
   # Windows (CMD)
   set GH_TOKEN=your_github_token_here
   
   # Mac/Linux
   export GH_TOKEN=your_github_token_here
   ```

   Or create a `.env` file in the project root:
   ```
   GH_TOKEN=your_github_token_here
   ```

## Release Workflow

### Option 1: Quick Release (Recommended)

```bash
# 1. Make your code changes

# 2. Bump version (choose one):
npm run version:patch   # 1.0.0 -> 1.0.1 (bug fixes)
npm run version:minor   # 1.0.0 -> 1.1.0 (new features)
npm run version:major   # 1.0.0 -> 2.0.0 (breaking changes)

# 3. Build and publish to GitHub
npm run release
```

### Option 2: Manual Steps

```bash
# 1. Update version in package.json manually
# Change "version": "1.0.0" to "1.0.1"

# 2. Commit the version change
git add package.json package-lock.json
git commit -m "v1.0.1"
git tag v1.0.1
git push && git push --tags

# 3. Build and publish
npm run release
```

## What Happens After Release

1. **electron-builder** creates the installer and uploads it to GitHub Releases
2. The release is published with the version tag (e.g., `v1.0.1`)
3. **Next time users open the app**, it checks for updates automatically
4. If an update is found:
   - A tray balloon notification appears: "Update Ready - Restart cascayd to apply the update"
   - Users restart the app
   - Update installs automatically

## Testing Updates

### Test the Auto-Update Flow:

1. Build version 1.0.0 and install it
2. Make a change to the app
3. Bump to version 1.0.1 and release it
4. Open the installed 1.0.0 version
5. Wait ~30 seconds - you should see the update notification
6. Restart the app - it will update to 1.0.1

## Manual Distribution (First Install Only)

For the **first installation**, send your cofounder the installer from:
- GitHub Releases page: https://github.com/Ertersy40/timetracker/releases
- Or from the `dist/` folder: `Cascayd TimeTracker Setup X.X.X.exe`

After that, all updates happen automatically!

## Build Without Publishing

To build locally without publishing to GitHub:

```bash
npm run build
```

The installer will be in the `dist/` folder.

## Troubleshooting

### "GH_TOKEN is not set"
- Make sure you set the `GH_TOKEN` environment variable before running `npm run release`

### "Publish skipped"
- Check that you're using `npm run release` (not `npm run build`)
- Verify your GitHub token has `repo` permissions

### Update not detected
- Make sure the version number increased
- Check GitHub Releases page has the new version
- The app checks for updates every time it starts

## Version Strategy

- **Patch** (1.0.x): Bug fixes, small tweaks
- **Minor** (1.x.0): New features, improvements
- **Major** (x.0.0): Breaking changes, major redesigns
