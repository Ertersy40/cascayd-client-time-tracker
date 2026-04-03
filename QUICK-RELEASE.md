# Quick Release Workflow

## One-Time Setup

1. **Create GitHub repo** (if not done):
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/YOUR_USERNAME/cascayd-timetracker.git
   git push -u origin main
   ```

2. **Update package.json**:
   - Replace `YOUR_USERNAME` with your GitHub username (2 places)

3. **Set GitHub Token**:
   - Get token from: https://github.com/settings/tokens
   - Set environment variable: `GH_TOKEN=your_token`

## Every Release (The Easy Way)

**Option 1: Use release script**
```bash
.\release.bat 1.0.1
```

**Option 2: Manual**
```bash
# 1. Edit package.json version: "1.0.1"

# 2. Run
git add .
git commit -m "Release v1.0.1"
git tag v1.0.1
git push && git push --tags
npm run publish
```

## That's It!

Your cofounder's app will auto-update next time they restart.

## First Time Only

Your cofounder needs to manually install the first version. After that, all updates are automatic.

Send them: The installer from GitHub releases page
