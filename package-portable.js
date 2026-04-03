const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

console.log('Building portable package...\n');

// Create dist directory
const distDir = path.join(__dirname, 'dist');
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir);
}

// Package with electron-packager
const packager = spawn('npx', [
  'electron-packager',
  '.',
  'cascayd',
  '--platform=win32',
  '--arch=x64',
  '--out=dist',
  '--overwrite',
  '--icon=node_modules/electron/dist/resources/default_app.asar.unpacked/default_app.png'
], { shell: true, stdio: 'inherit' });

packager.on('close', (code) => {
  if (code !== 0) {
    console.error(`Packaging failed with code ${code}`);
    process.exit(code);
  }

  console.log('\n✓ Packaging complete');
  console.log('✓ Your cofounder can run "Cascayd TimeTracker.exe" from the dist folder');
  console.log('\nFiles are in: dist\\Cascayd TimeTracker-win32-x64\\');
});
