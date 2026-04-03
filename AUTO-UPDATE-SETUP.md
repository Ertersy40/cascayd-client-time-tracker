# Auto-Update Setup Guide

This guide shows you how to set up automatic updates so you can push new versions to your cofounder without manually sending files.

## Initial Setup (One Time)

### 1. Create GitHub Repository

```bash
cd C:\Users\wonk4\Desktop\Coding\timetracker
git init
git add .
git commit -m "Initial commit"
```

Then create a repo on GitHub (e.g., `cascayd-timetracker`) and push:

```bash
git remote add origin https://github.com/YOUR_USERNAME/cascayd-timetracker.git
git push -u origin main
```

### 2. Update package.json

Replace `YOUR_USERNAME` in `package.json` with your actual GitHub username in both places:
- `repository.url`
- `build.publish.owner`

### 3. Get GitHub Token

1. Go to https://github.com/settings/tokens
2. Click "Generate new token (classic)"
3. Give it a name like "cascayd-timetracker-releases"
4. Check the `repo` scope (full control of private repositories)
5. Generate token and copy it

### 4. Set Environment Variable

**Windows (PowerShell):**
```powershell
$env:GH_TOKEN="your_token_here"
```

To make it permanent, add to your user environment variables:
1. Search for "Environment Variables" in Windows
2. Click "Edit the system environment variables"
3. Click "Environment Variables..."
4. Under "User variables", click "New..."
5. Variable name: `GH_TOKEN`
6. Variable value: your token
7. Click OK

## Releasing Updates

### 1. Update Version

Edit `package.json` and bump the version:
```json
"version": "1.0.1"
```

### 2. Build and Publish

```bash
npm run publish
```

This will:
- Build the app with electron-builder
- Create a GitHub release
- Upload the installer

### 3. Your Cofounder Gets Update

When he restarts the app:
1. App checks for updates automatically
2. Downloads update in background
3. Shows notification: "Update Ready"
4. He restarts the app to apply update

## Quick Release Workflow

Every time you want to push an update:

```bash
# 1. Update version in package.json (bump 1.0.0 → 1.0.1)

# 2. Commit changes
git add .
git commit -m "Fix: description of changes"

# 3. Create git tag
git tag v1.0.1

# 4. Push to GitHub
git push && git push --tags

# 5. Build and publish
npm run publish
```

## Testing Updates

To test updates yourself:
1. Install the app from the release
2. Make a change and publish a new version
3. Open the installed app
4. It should detect and download the update

## Troubleshooting

**Update not detected:**
- Make sure version in package.json is higher than installed version
- Check GitHub releases page to verify release was created
- Look at console logs when app starts

**Build fails:**
- Check that GH_TOKEN environment variable is set
- Make sure you have permissions to create releases
- Verify repository URL in package.json is correct

**Manual install still needed first time:**
- Yes, your cofounder needs to manually install v1.0.0
- After that, all updates are automatic
