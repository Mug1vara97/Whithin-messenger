const { execSync } = require('node:child_process');
const path = require('node:path');

const electronDir = path.join(__dirname, '..');

console.log('[prepare-dist] rebuilding native modules for Electron...');
execSync('npx @electron/rebuild -f -w process-audio-capture global-mouse-events', {
  cwd: electronDir,
  stdio: 'inherit',
});

console.log('[prepare-dist] done');
