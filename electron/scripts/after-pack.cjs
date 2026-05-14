const path = require('node:path');
const fs = require('node:fs');

/**
 * При win.signAndEditExecutable=false electron-builder не вызывает rcedit,
 * и в exe остаётся иконка Electron. Встраиваем app-icon.ico после упаковки.
 * @param {object} context electron-builder afterPack context
 */
module.exports = async function afterPack(context) {
  if (context.electronPlatformName !== 'win32') {
    return;
  }

  const { appOutDir, packager } = context;
  const productFilename = packager.appInfo.productFilename;
  const exePath = path.join(appOutDir, `${productFilename}.exe`);
  const projectDir = packager.projectDir;
  const iconPath = path.join(projectDir, 'app-icon.ico');

  if (!fs.existsSync(exePath)) {
    console.warn(`[afterPack] exe not found: ${exePath}`);
    return;
  }
  if (!fs.existsSync(iconPath)) {
    console.warn(`[afterPack] icon not found: ${iconPath}`);
    return;
  }

  const rcedit = require('rcedit');
  const appInfo = packager.appInfo;
  const winVer = appInfo.getVersionInWeirdWindowsForm();

  await rcedit(exePath, {
    icon: iconPath,
    'version-string': {
      FileDescription: appInfo.productName,
      ProductName: appInfo.productName,
      LegalCopyright: appInfo.copyright
    },
    'file-version': appInfo.shortVersion || winVer,
    'product-version': appInfo.shortVersionWindows || winVer
  });

  console.log('[afterPack] embedded icon into', exePath);
};
