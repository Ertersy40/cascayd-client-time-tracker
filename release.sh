#!/bin/bash

# Simple release script for cascayd-timetracker

if [ -z "$1" ]; then
  echo "Usage: ./release.sh <version>"
  echo "Example: ./release.sh 1.0.1"
  exit 1
fi

VERSION=$1

echo "Releasing version $VERSION..."

# Update package.json version
node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json'));
pkg.version = '$VERSION';
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
"

# Commit and tag
git add package.json
git commit -m "Release v$VERSION"
git tag "v$VERSION"

# Push
git push && git push --tags

# Build and publish
npm run publish

echo "✅ Release v$VERSION published!"
echo "Your cofounder will get the update next time they restart the app."
