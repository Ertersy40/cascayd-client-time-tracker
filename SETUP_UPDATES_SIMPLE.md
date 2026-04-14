# Auto-Update Setup (Simple Version - Using .env)

## Step 1: Make Your Repo Public

1. Go to: https://github.com/Ertersy40/timetracker
2. Click **Settings** (top right)
3. Scroll to bottom → **Danger Zone**
4. Click **Change visibility** → **Make public**
5. Confirm

✅ Done! Your code is public, AWS credentials stay private in `.env`

## Step 2: Add GitHub Token to .env

1. Get a GitHub token:
   - Go to: https://github.com/settings/tokens
   - Click **Generate new token (classic)**
   - Name it: `TimeTracker Releases`
   - Check: **✓ repo**
   - Click **Generate token**
   - **Copy the token**

2. Add to your `.env` file:
   ```
   GH_TOKEN=paste_your_token_here
   ```

✅ You already did this! Token is in `.env`

## Step 3: Build First Version

```bash
npm run build
```

Installer will be in `dist/Cascayd TimeTracker Setup 1.0.0.exe`

## Step 4: Install on Both Machines

1. Install on your machine
2. Send installer to your cofounder
3. They install it

✅ Both ready to receive updates!

## Step 5: Push Updates (Anytime)

```bash
./release-update.bat
```

Choose option:
- **1** = Patch (1.0.0 → 1.0.1) - Bug fixes
- **2** = Minor (1.0.0 → 1.1.0) - New features
- **3** = Major (1.0.0 → 2.0.0) - Breaking changes

**That's it!** The script will:
- ✅ Bump version
- ✅ Build installer
- ✅ Upload to GitHub
- ✅ Push to everyone automatically

## How Updates Appear

Next time you or your cofounder open the app:
1. App checks GitHub (10 seconds)
2. Dialog: **"Version X.X.X ready - Restart now?"**
3. Click **"Restart Now"**
4. Update installs automatically

## Security Check

✅ **In .env (NOT in git):**
- AWS credentials
- GitHub token

✅ **.env is in .gitignore** - Never committed to git

✅ **Safe to make repo public** - No secrets exposed

## Quick Commands

```bash
# Build locally (test, no publish)
npm run build

# Publish update to everyone
./release-update.bat
```

## Check Your Releases

https://github.com/Ertersy40/timetracker/releases

## That's It!

No system environment variables needed. Everything in `.env`. Super simple! 🎉
