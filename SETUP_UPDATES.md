# Auto-Update Setup Guide (Public Repo)

## Step 1: Make Your Repo Public

1. Go to your GitHub repo: https://github.com/Ertersy40/timetracker
2. Click **Settings** (top right)
3. Scroll to bottom → **Danger Zone**
4. Click **Change visibility** → **Make public**
5. Confirm by typing the repo name

✅ Your code is now public (AWS credentials are still safe in `.env`)

## Step 2: Create GitHub Personal Access Token

1. Go to: https://github.com/settings/tokens
2. Click **Generate new token (classic)**
3. Give it a name: `TimeTracker Releases`
4. Select scope: **✓ repo** (check this box)
5. Click **Generate token**
6. **Copy the token** (you won't see it again!)

## Step 3: Set Environment Variable (Windows)

### Option A: Permanently (Recommended)

1. Search for "Environment Variables" in Windows Start
2. Click "Edit the system environment variables"
3. Click **Environment Variables** button
4. Under "User variables", click **New**
5. Variable name: `GH_TOKEN`
6. Variable value: Paste your token
7. Click **OK** on all windows
8. **Restart your terminal** (important!)

### Option B: Temporarily (for testing)

```powershell
$env:GH_TOKEN="your_token_here"
```

(You'll need to do this every time you open a new terminal)

## Step 4: Test the Setup

```bash
# Check if token is set
echo $env:GH_TOKEN

# Should show your token (not empty)
```

## Step 5: Build Your First Release

```bash
# Make sure you're on version 1.0.0
npm run build
```

The installer will be in `dist/Cascayd TimeTracker Setup 1.0.0.exe`

## Step 6: Install on Both Machines

1. Install on your machine from the `dist/` folder
2. Send the installer to your cofounder
3. They install it
4. **Done!** Both installations are ready to receive updates

## Step 7: Push Your First Update

### Easy Way:

```bash
./release-update.bat
```

Choose option 1 (Patch) to go from 1.0.0 → 1.0.1

### What Happens:

1. ✅ Version bumps to 1.0.1
2. ✅ Git commit & tag created
3. ✅ Installer built
4. ✅ Uploaded to GitHub Releases
5. ✅ Next time you or your cofounder open the app → Update notification!

## Step 8: How Updates Work

**For You & Your Cofounder:**

1. Open the app (it's already running from startup)
2. App checks GitHub in background (takes ~10 seconds)
3. If update found → Downloads automatically
4. Dialog appears: **"Version 1.0.1 ready - Restart now?"**
5. Click **"Restart Now"** → App updates itself
6. Done!

## Troubleshooting

### "GH_TOKEN is not set"
→ Set the environment variable (Step 3) and restart your terminal

### "npm ERR! need auth"
→ Make sure your token has `repo` permission

### "Repository not found"
→ Make sure the repo is public

### Update not appearing
→ Check https://github.com/Ertersy40/timetracker/releases
→ Make sure version number increased

## Future Workflow

Every time you want to push an update:

```bash
# 1. Make your code changes
# 2. Run the release script
./release-update.bat

# That's it! Update pushes to everyone automatically.
```

## Security Notes

✅ **Safe in public repo:**
- Your code (tracking logic, UI, etc.)

❌ **NOT in repo (stays private):**
- `.env` file with AWS credentials
- Built installers with credentials

✅ **AWS credentials are safe because:**
- `.env` is in `.gitignore`
- Credentials only exist in the built `.exe` files you share
- Those files are never committed to git

## Quick Reference

**Build locally (no publish):**
```bash
npm run build
```

**Build and publish update:**
```bash
./release-update.bat
```

**Check releases:**
https://github.com/Ertersy40/timetracker/releases

**Where users see updates:**
They just open the app and get a notification automatically!
