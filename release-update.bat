@echo off
REM Quick release script for Windows

echo ======================================
echo Cascayd TimeTracker - Release Update
echo ======================================
echo.

REM Check if GH_TOKEN is set
if "%GH_TOKEN%"=="" (
    echo ERROR: GH_TOKEN environment variable not set!
    echo.
    echo Please set your GitHub token:
    echo   set GH_TOKEN=your_github_token_here
    echo.
    echo Or create a .env file with:
    echo   GH_TOKEN=your_github_token_here
    echo.
    pause
    exit /b 1
)

echo Current version:
type package.json | findstr "version"
echo.

echo What type of release?
echo   1) Patch (1.0.0 -> 1.0.1) - Bug fixes
echo   2) Minor (1.0.0 -> 1.1.0) - New features
echo   3) Major (1.0.0 -> 2.0.0) - Breaking changes
echo   4) Cancel
echo.

set /p choice="Enter choice (1-4): "

if "%choice%"=="1" (
    echo.
    echo Bumping patch version...
    call npm run version:patch
    if errorlevel 1 goto error
) else if "%choice%"=="2" (
    echo.
    echo Bumping minor version...
    call npm run version:minor
    if errorlevel 1 goto error
) else if "%choice%"=="3" (
    echo.
    echo Bumping major version...
    call npm run version:major
    if errorlevel 1 goto error
) else (
    echo.
    echo Cancelled.
    pause
    exit /b 0
)

echo.
echo New version:
type package.json | findstr "version"
echo.

echo Building and publishing to GitHub...
call npm run release
if errorlevel 1 goto error

echo.
echo ======================================
echo SUCCESS! Update published to GitHub
echo ======================================
echo.
echo Users will receive the update automatically next time they open the app.
echo Check releases: https://github.com/Ertersy40/timetracker/releases
echo.
pause
exit /b 0

:error
echo.
echo ======================================
echo ERROR: Release failed!
echo ======================================
echo.
pause
exit /b 1
