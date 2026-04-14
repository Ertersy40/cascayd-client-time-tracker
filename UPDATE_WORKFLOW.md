# Update Workflow - Quick Reference

## First Time Setup (One Time Only)

### 1. Get GitHub Token
- Go to: https://github.com/settings/tokens
- Click "Generate new token (classic)"
- Check the `repo` scope
- Copy the token

### 2. Set Environment Variable

**Windows (add to your system environment variables):**
1. Search "Environment Variables" in Windows
2. Add new variable: `GH_TOKEN` = `your_token_here`
3. Restart your terminal

**Or set temporarily in terminal:**
```bash
# Windows PowerShell
$env:GH_TOKEN="your_token_here"

# Windows CMD
set GH_TOKEN=your_token_here
```

## Every Time You Want to Push an Update

### Super Easy Way (Recommended)

**Windows:**
```bash
./release-update.bat
```

**Mac/Linux:**
```bash
./release-update.sh
```

The script will:
1. Ask what type of update (patch/minor/major)
2. Bump the version automatically
3. Build the installer
4. Upload to GitHub
5. Done!

### Manual Way

```bash
# 1. Bump version
npm run version:patch    # or version:minor or version:major

# 2. Build and publish
npm run release
```

## What Happens Next

1. ✅ Installer uploaded to GitHub Releases
2. ✅ Next time users open the app, it checks for updates
3. ✅ Update downloads in background
4. ✅ Notification appears: "Update Ready - Restart to apply"
5. ✅ User restarts → Update installs automatically

**You never need to manually distribute installers again!**

## Version Numbers Explained

- **Patch** (1.0.x): Bug fixes, tiny changes
- **Minor** (1.x.0): New features
- **Major** (x.0.0): Big changes

## Common Issues

**"GH_TOKEN not set"**
→ Make sure you set the environment variable and restarted your terminal

**"npm ERR! need auth"**
→ Your GitHub token needs the `repo` permission

**Users not getting update**
→ Make sure version number increased in package.json

## Check Your Releases

https://github.com/Ertersy40/timetracker/releases

You can see all published versions here. Users download from this page automatically.
