#!/bin/bash

# Quick release script for Mac/Linux

echo "======================================"
echo "Cascayd TimeTracker - Release Update"
echo "======================================"
echo ""

# Check if .env file exists
if [ ! -f .env ]; then
    echo "ERROR: .env file not found!"
    echo ""
    echo "Please create a .env file with your GitHub token:"
    echo "  GH_TOKEN=your_github_token_here"
    echo ""
    echo "Get a token from: https://github.com/settings/tokens"
    echo ""
    exit 1
fi

# Check if GH_TOKEN is in .env
if ! grep -q "GH_TOKEN=" .env; then
    echo "ERROR: GH_TOKEN not found in .env file!"
    echo ""
    echo "Please add to .env:"
    echo "  GH_TOKEN=your_github_token_here"
    echo ""
    echo "Get a token from: https://github.com/settings/tokens"
    echo ""
    exit 1
fi

echo "Current version:"
grep '"version"' package.json
echo ""

echo "What type of release?"
echo "  1) Patch (1.0.0 -> 1.0.1) - Bug fixes"
echo "  2) Minor (1.0.0 -> 1.1.0) - New features"
echo "  3) Major (1.0.0 -> 2.0.0) - Breaking changes"
echo "  4) Cancel"
echo ""

read -p "Enter choice (1-4): " choice

case $choice in
    1)
        echo ""
        echo "Bumping patch version..."
        npm run version:patch || exit 1
        ;;
    2)
        echo ""
        echo "Bumping minor version..."
        npm run version:minor || exit 1
        ;;
    3)
        echo ""
        echo "Bumping major version..."
        npm run version:major || exit 1
        ;;
    *)
        echo ""
        echo "Cancelled."
        exit 0
        ;;
esac

echo ""
echo "New version:"
grep '"version"' package.json
echo ""

echo "Building and publishing to GitHub..."
npm run release || {
    echo ""
    echo "======================================"
    echo "ERROR: Release failed!"
    echo "======================================"
    echo ""
    exit 1
}

echo ""
echo "======================================"
echo "SUCCESS! Update published to GitHub"
echo "======================================"
echo ""
echo "Users will receive the update automatically next time they open the app."
echo "Check releases: https://github.com/Ertersy40/timetracker/releases"
echo ""
