const path = require('node:path');
const fs = require('node:fs');

/**
 * В dev-режиме taskbar показывает electron.exe — подменяем иконку через rcedit.
 * Повторно патчим, если изменился app-icon.ico, electron.exe или версия electron.
 */
async function main() {
  if (process.platform !== 'win32') {
    return;
  }

  const projectDir = path.join(__dirname, '..');
  const electronExe = path.join(projectDir, 'node_modules', 'electron', 'dist', 'electron.exe');
  const iconPath = path.join(projectDir, 'app-icon.ico');
  const markerPath = path.join(projectDir, 'node_modules', '.whithin-icon-patched');
  const forcePatch = process.env.WHITHIN_FORCE_ICON_PATCH === '1';

  if (!fs.existsSync(electronExe)) {
    console.warn('[patch-electron-exe-icon] electron.exe not found, skip');
    return;
  }
  if (!fs.existsSync(iconPath)) {
    console.warn('[patch-electron-exe-icon] app-icon.ico not found, skip');
    return;
  }

  const iconMtime = fs.statSync(iconPath).mtimeMs;
  const electronMtime = fs.statSync(electronExe).mtimeMs;
  let electronVersion = 'unknown';
  try {
    electronVersion = require(path.join(projectDir, 'node_modules', 'electron', 'package.json')).version;
  } catch {
    // ignore
  }

  if (!forcePatch && fs.existsSync(markerPath)) {
    try {
      const marker = JSON.parse(fs.readFileSync(markerPath, 'utf8'));
      if (
        marker.iconMtime === iconMtime &&
        marker.electronMtime === electronMtime &&
        marker.electronVersion === electronVersion
      ) {
        console.log('[patch-electron-exe-icon] electron.exe already patched');
        return;
      }
    } catch {
      // Re-patch if marker is corrupted.
    }
  }

  const rcedit = require('rcedit');
  await rcedit(electronExe, { icon: iconPath });
  fs.writeFileSync(
    markerPath,
    JSON.stringify({ iconMtime, electronMtime, electronVersion }),
    'utf8',
  );
  console.log('[patch-electron-exe-icon] applied Whithin icon to electron.exe');
}

main().catch((error) => {
  console.warn('[patch-electron-exe-icon] failed:', error.message);
});
