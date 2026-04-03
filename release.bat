@echo off
setlocal

if "%1"=="" (
  echo Usage: release.bat ^<version^>
  echo Example: release.bat 1.0.1
  exit /b 1
)

set VERSION=%1

echo Releasing version %VERSION%...

:: Update package.json version
node -e "const fs = require('fs'); const pkg = JSON.parse(fs.readFileSync('package.json')); pkg.version = '%VERSION%'; fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');"

:: Commit and tag
git add package.json
git commit -m "Release v%VERSION%"
git tag "v%VERSION%"

:: Push
git push
git push --tags

:: Build and publish
call npm run publish

echo.
echo ✅ Release v%VERSION% published!
echo Your cofounder will get the update next time they restart the app.
