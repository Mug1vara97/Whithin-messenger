const path = require('node:path');
const fs = require('node:fs');
const {
  app,
  BrowserWindow,
  ipcMain,
  shell,
  desktopCapturer,
  session,
  globalShortcut,
  Tray,
  Menu,
  nativeImage
} = require('electron');

const rendererUrl = process.env.WEB_CLIENT_URL || 'https://whithin.ru';

/** Дополнительные origin через запятую (напр. http://127.0.0.1:5173 для dev) */
function getAppNavigationOrigins() {
  try {
    const u = new URL(rendererUrl);
    const extra = process.env.ELECTRON_EXTRA_ORIGINS
      ? process.env.ELECTRON_EXTRA_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean)
      : [];
    return [u.origin, ...extra];
  } catch {
    return ['https://whithin.ru'];
  }
}

/** true — открыть в системном браузере, не в этом окне Electron */
function shouldOpenExternalInstead(urlString) {
  if (!urlString || urlString.startsWith('about:')) {
    return false;
  }
  try {
    const urlObj = new URL(urlString);
    if (
      ['javascript:', 'data:', 'blob:', 'chrome:', 'chrome-extension:'].includes(urlObj.protocol)
    ) {
      return false;
    }
    const origins = getAppNavigationOrigins();
    return !origins.some((o) => urlString.startsWith(o));
  } catch {
    return false;
  }
}

/** Внешние http(s)/mailto/tel — в браузере по умолчанию; свой сайт остаётся во встроенном окне */
function attachExternalLinksPolicy(webContents) {
  webContents.on('will-navigate', (event, url) => {
    if (shouldOpenExternalInstead(url)) {
      event.preventDefault();
      shell.openExternal(url).catch(() => {});
    }
  });

  webContents.setWindowOpenHandler(({ url }) => {
    if (!url || url === 'about:blank') {
      return { action: 'deny' };
    }
    if (shouldOpenExternalInstead(url)) {
      shell.openExternal(url).catch(() => {});
      return { action: 'deny' };
    }
    return {
      action: 'allow',
      overrideBrowserWindowOptions: {
        webPreferences: {
          preload: path.join(__dirname, 'preload.cjs'),
          nodeIntegration: false,
          contextIsolation: true,
          sandbox: false
        }
      }
    };
  });
}

/** Как у списка серверов: --server-list-background / ServerList.module.css */
const SERVER_LIST_BAR_COLOR = '#1e1f22';

/** Подпись в левой части кастомной шапки (Win/Linux) */
const APP_DISPLAY_NAME = 'Whithin';

/** Высота полоски шапки; синхронно с preload.cjs TITLE_BAR_OVERLAY_HEIGHT */
const TITLE_BAR_OVERLAY_HEIGHT = 32;

/** Зона справа: три кнопки с иконками + отступы */
const TITLEBAR_DRAG_RIGHT_RESERVE_PX = 124;

let mainWindow = null;
let shortcutCallbackWebContents = null;
let selectedScreenSource = null;
let tray = null;
/** true — настоящий выход (меню трея); false — крестик сворачивает в трей */
let allowAppQuit = false;

const ELECTRON_KEY_ALIASES = {
  ArrowUp: 'Up',
  ArrowDown: 'Down',
  ArrowLeft: 'Left',
  ArrowRight: 'Right',
  Escape: 'Esc',
  '/': 'Slash',
  ' ': 'Space',
  'Enter': 'Return',
  'Delete': 'Delete',
  'Backspace': 'Backspace',
  'Tab': 'Tab'
};

/**
 * Правки строк из настроек (Ctrl+Key, F1, Cmd+…) в формат Electron globalShortcut.
 * @see https://www.electronjs.org/docs/latest/api/accelerator
 */
function webHotkeyToElectronAccelerator(webkit) {
  if (!webkit || typeof webkit !== 'string') {
    return null;
  }
  if (/Mouse|Click|AuxClick/i.test(webkit)) {
    return null;
  }
  const parts = webkit.split('+').map((p) => p.trim()).filter(Boolean);
  if (!parts.length) {
    return null;
  }
  const isDarwin = process.platform === 'darwin';
  const out = parts.map((p) => {
    if (p === 'Meta' || p === 'Command' || p === 'Cmd') {
      return isDarwin ? 'Command' : 'Super';
    }
    if (p === 'Control' || p === 'Ctrl') {
      return 'Control';
    }
    if (p === 'Alt' || p === 'AltGraph') {
      return 'Alt';
    }
    if (p === 'Shift') {
      return 'Shift';
    }
    if (ELECTRON_KEY_ALIASES[p]) {
      return ELECTRON_KEY_ALIASES[p];
    }
    if (p.length === 1) {
      return p.toLocaleUpperCase('en-US');
    }
    if (/^F\d+$/i.test(p)) {
      return p.toUpperCase();
    }
    return p;
  });
  return out.join('+');
}

function openScreenPickerWindow(sources) {
  return new Promise((resolve) => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      resolve(null);
      return;
    }

    const pickerWindow = new BrowserWindow({
      width: 960,
      height: 680,
      parent: mainWindow,
      modal: true,
      resizable: false,
      minimizable: false,
      maximizable: false,
      autoHideMenuBar: true,
      title: 'Choose source for screen sharing',
      backgroundColor: '#0f1014',
      webPreferences: {
        preload: path.join(__dirname, 'picker-preload.cjs'),
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: false
      }
    });

    const payload = sources.map((source) => {
      const sourceNameLower = (source.name || '').toLowerCase();
      const isWhithinWindow = sourceNameLower.includes('whithin') || sourceNameLower.includes('electron');
      const sourceType = source.id.startsWith('screen:') ? 'screen' : 'window';
      return {
        id: source.id,
        name: source.name,
        type: sourceType,
        thumbnail: source.thumbnail?.toDataURL?.() || null,
        // Для экрана используем system audio (loopback), для окна — audio конкретного окна.
        // Окно самого Whithin исключаем, чтобы не ловить эхо звонка.
        canShareAudio: sourceType === 'screen' || (sourceType === 'window' && !isWhithinWindow)
      };
    });

    let isResolved = false;
    const finalize = (value) => {
      if (isResolved) return;
      isResolved = true;
      ipcMain.removeListener('electron:screen-picker-submit', handleSubmit);
      ipcMain.removeListener('electron:screen-picker-cancel', handleCancel);
      if (!pickerWindow.isDestroyed()) {
        pickerWindow.close();
      }
      resolve(value);
    };

    const handleSubmit = (_event, data) => finalize(data);
    const handleCancel = () => finalize(null);

    ipcMain.once('electron:screen-picker-submit', handleSubmit);
    ipcMain.once('electron:screen-picker-cancel', handleCancel);

    pickerWindow.on('closed', () => finalize(null));
    pickerWindow.webContents.on('did-finish-load', () => {
      pickerWindow.webContents.send('electron:screen-picker-sources', payload);
    });
    pickerWindow.loadFile(path.join(__dirname, 'screen-picker.html'));
  });
}

/**
 * Только Electron shell: безрамное окно + шапка без правок веб-клиента.
 */
function buildElectronTitlebarChromeCss(h, reserve, barColor) {
  return `
html { height: 100%; overflow: hidden; }
/* На всю ширину под шапкой окна */
#electron-titlebar-fill {
  position: fixed !important;
  top: 0 !important;
  left: 0 !important;
  right: 0 !important;
  height: ${h}px !important;
  background: ${barColor} !important;
  z-index: 2147483646 !important;
  pointer-events: none !important;
}
body.electron-titlebar-chrome {
  margin: 0;
  height: 100vh;
  box-sizing: border-box;
  padding-top: ${h}px;
  overflow: hidden;
}
body.electron-titlebar-chrome #root {
  height: 100% !important;
  min-height: 0 !important;
  padding-top: 0 !important;
}
body.electron-titlebar-chrome #root .app,
body.electron-titlebar-chrome .app {
  min-height: 100% !important;
  height: 100% !important;
}
body.electron-titlebar-chrome .home-page {
  height: 100% !important;
  min-height: 0 !important;
}
body.electron-titlebar-chrome .loading-container {
  min-height: 100% !important;
  height: 100% !important;
}
body.electron-titlebar-chrome .friends-page,
body.electron-titlebar-chrome .friends-panel {
  height: 100% !important;
}
body.electron-titlebar-chrome .auth-container {
  min-height: 100% !important;
}
body.electron-titlebar-chrome .server-discovery {
  min-height: 100% !important;
}
body.electron-titlebar-chrome .role-management,
body.electron-titlebar-chrome .role-management-content {
  height: 100% !important;
  min-height: 0 !important;
}
body.electron-titlebar-chrome .server-settings-page,
body.electron-titlebar-chrome .server-settings-loading,
body.electron-titlebar-chrome .server-settings-error {
  min-height: 100% !important;
}
/* Кнопки окна: сами пиктограммы цветом «светофора», без залитого фона */
#electron-window-controls {
  position: fixed !important;
  top: 0 !important;
  right: 10px !important;
  height: ${h}px !important;
  display: flex !important;
  flex-direction: row !important;
  align-items: center !important;
  justify-content: flex-end !important;
  gap: 4px !important;
  z-index: 2147483647 !important;
  -webkit-app-region: no-drag !important;
  pointer-events: auto !important;
}
button.electron-tl {
  width: 30px !important;
  height: 24px !important;
  min-width: 30px !important;
  border-radius: 4px !important;
  border: none !important;
  padding: 0 !important;
  margin: 0 !important;
  cursor: pointer !important;
  flex-shrink: 0 !important;
  box-sizing: border-box !important;
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  background: transparent !important;
}
button.electron-tl svg {
  display: block !important;
  pointer-events: none !important;
}
button.electron-tl:hover {
  background: rgba(255, 255, 255, 0.06) !important;
  filter: none !important;
}
button.electron-tl:active {
  background: rgba(0, 0, 0, 0.12) !important;
}
#electron-titlebar-drag-shim {
  position: fixed !important;
  top: 0 !important;
  left: 0 !important;
  right: ${reserve}px !important;
  height: ${h}px !important;
  display: flex !important;
  align-items: center !important;
  padding-left: 12px !important;
  box-sizing: border-box !important;
  -webkit-app-region: drag !important;
  app-region: drag !important;
  z-index: 2147483647 !important;
}
#electron-titlebar-drag-shim .electron-titlebar-app-name {
  font-size: 13px !important;
  font-weight: 600 !important;
  letter-spacing: 0.01em !important;
  color: #dcddde !important;
  font-family: 'Segoe UI', system-ui, -apple-system, 'Helvetica Neue', sans-serif !important;
  pointer-events: none !important;
  -webkit-user-select: none !important;
  user-select: none !important;
  white-space: nowrap !important;
  overflow: hidden !important;
  text-overflow: ellipsis !important;
  min-width: 0 !important;
}
`.trim();
}

/**
 * Шапка без системных кнопок: заливка, drag, кастомные «светофоры» через preload IPC.
 */
function installCustomTitlebarChrome(webContents) {
  if (process.platform !== 'win32' && process.platform !== 'linux') {
    return;
  }

  const h = TITLE_BAR_OVERLAY_HEIGHT;
  const reserve = TITLEBAR_DRAG_RIGHT_RESERVE_PX;
  const chromeCss = buildElectronTitlebarChromeCss(h, reserve, SERVER_LIST_BAR_COLOR);
  const appTitleJson = JSON.stringify(APP_DISPLAY_NAME);

  webContents.on('dom-ready', async () => {
    try {
      await webContents.executeJavaScript(`
        (function () {
          var appTitle = ${appTitleJson};
          var css = ${JSON.stringify(chromeCss)};
          document.body.classList.add('electron-titlebar-chrome');
          var st = document.getElementById('electron-titlebar-style');
          if (!st) {
            st = document.createElement('style');
            st.id = 'electron-titlebar-style';
            document.head.appendChild(st);
          }
          st.textContent = css;
          var prevFill = document.getElementById('electron-titlebar-fill');
          if (prevFill) prevFill.remove();
          var fill = document.createElement('div');
          fill.id = 'electron-titlebar-fill';
          fill.setAttribute('aria-hidden', 'true');
          document.body.appendChild(fill);
          var prev = document.getElementById('electron-titlebar-drag-shim');
          if (prev) prev.remove();
          var shim = document.createElement('div');
          shim.id = 'electron-titlebar-drag-shim';
          var titleEl = document.createElement('span');
          titleEl.className = 'electron-titlebar-app-name';
          titleEl.textContent = appTitle;
          shim.appendChild(titleEl);
          document.body.appendChild(shim);
          var prevCtr = document.getElementById('electron-window-controls');
          if (prevCtr) prevCtr.remove();
          if (window.electronAPI && typeof window.electronAPI.windowClose === 'function') {
            var cMax = '#28c840';
            var cMin = '#ffbd2e';
            var cClose = '#ff5f57';
            var sw = '1.35';
            var iconMax =
              '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">' +
              '<rect x="1.75" y="1.75" width="8.5" height="8.5" rx="1" fill="none" stroke="' +
              cMax +
              '" stroke-width="' +
              sw +
              '"/></svg>';
            var iconMin =
              '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">' +
              '<path stroke="' +
              cMin +
              '" stroke-width="' +
              sw +
              '" stroke-linecap="round" d="M2.25 9h7.5"/></svg>';
            var iconClose =
              '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">' +
              '<path stroke="' +
              cClose +
              '" stroke-width="' +
              sw +
              '" stroke-linecap="round" d="M3 3l6 6M9 3L3 9"/></svg>';
            var ctr = document.createElement('div');
            ctr.id = 'electron-window-controls';
            function addTl(cls, label, fn, svgHtml) {
              var b = document.createElement('button');
              b.type = 'button';
              b.className = 'electron-tl ' + cls;
              b.title = label;
              b.setAttribute('aria-label', label);
              b.innerHTML = svgHtml;
              b.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();
                fn();
              });
              ctr.appendChild(b);
            }
            addTl(
              'electron-tl-max',
              'Развернуть',
              function () {
                window.electronAPI.windowToggleMaximize();
              },
              iconMax
            );
            addTl(
              'electron-tl-min',
              'Свернуть',
              function () {
                window.electronAPI.windowMinimize();
              },
              iconMin
            );
            addTl(
              'electron-tl-close',
              'Закрыть',
              function () {
                window.electronAPI.windowClose();
              },
              iconClose
            );
            document.body.appendChild(ctr);
          }
        })();
      `);
    } catch (err) {
      console.error('installCustomTitlebarChrome:', err);
    }
  });
}

function registerGlobalShortcuts(shortcuts = {}) {
  globalShortcut.unregisterAll();

  Object.entries(shortcuts).forEach(([action, accelerator]) => {
    if (!accelerator) {
      return;
    }

    const acc = webHotkeyToElectronAccelerator(String(accelerator));
    if (!acc) {
      console.warn(`[shortcuts] Skip unsupported or mouse-only hotkey for "${action}":`, accelerator);
      return;
    }

    const registered = globalShortcut.register(acc, () => {
      if (!shortcutCallbackWebContents || shortcutCallbackWebContents.isDestroyed()) {
        return;
      }
      shortcutCallbackWebContents.send('global-shortcut-triggered', action);
    });

    if (!registered) {
      console.warn(
        `Failed to register shortcut "${acc}" (from "${accelerator}") for action "${action}"`
      );
    }
  });
}

function getTrayImage() {
  const iconPath = path.join(__dirname, 'tray.png');
  if (fs.existsSync(iconPath)) {
    const img = nativeImage.createFromPath(iconPath);
    if (!img.isEmpty()) {
      return img;
    }
  }
  return nativeImage.createFromDataURL(
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
  );
}

function showMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow();
    return;
  }
  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }
  mainWindow.show();
  mainWindow.focus();
}

function hideMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }
  mainWindow.hide();
}

function createTray() {
  if (tray) {
    return;
  }
  try {
    const icon = getTrayImage();
    if (icon.isEmpty()) {
      console.warn('Tray: пустая иконка, трей отключён');
      return;
    }
    tray = new Tray(icon);
    tray.setToolTip(APP_DISPLAY_NAME);
    tray.setContextMenu(
      Menu.buildFromTemplate([
        {
          label: 'Показать',
          click: () => showMainWindow()
        },
        {
          label: 'Скрыть',
          click: () => hideMainWindow()
        },
        { type: 'separator' },
        {
          label: 'Выход',
          click: () => {
            allowAppQuit = true;
            app.quit();
          }
        }
      ])
    );
    tray.on('click', () => {
      showMainWindow();
    });
  } catch (err) {
    console.error('Tray:', err);
  }
}

function createWindow() {
  const windowOptions = {
    title: APP_DISPLAY_NAME,
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    autoHideMenuBar: true,
    backgroundColor: SERVER_LIST_BAR_COLOR,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false
    }
  };

  /* Без рамки: свои кнопки «светофор»; thickFrame — края для ресайза на Windows */
  if (process.platform === 'win32' || process.platform === 'linux') {
    windowOptions.frame = false;
    windowOptions.thickFrame = true;
  }

  mainWindow = new BrowserWindow(windowOptions);

  attachExternalLinksPolicy(mainWindow.webContents);
  installCustomTitlebarChrome(mainWindow.webContents);

  mainWindow.loadURL(rendererUrl);

  mainWindow.on('close', (e) => {
    if (allowAppQuit) {
      return;
    }
    if (!tray) {
      return;
    }
    e.preventDefault();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    shortcutCallbackWebContents = null;
  });
}

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    showMainWindow();
  });

  app.whenReady().then(() => {
  session.defaultSession.setDisplayMediaRequestHandler(
    async (request, callback) => {
      try {
        const sources = await desktopCapturer.getSources({
          types: ['screen', 'window'],
          thumbnailSize: { width: 320, height: 180 }
        });

        const preferredSource = selectedScreenSource?.id
          ? sources.find((source) => source.id === selectedScreenSource.id)
          : sources.find((source) => source.name.toLowerCase().includes('screen')) || sources[0];

        const shouldCaptureAudio = Boolean(selectedScreenSource?.captureAudio);
        const selectedSourceType = selectedScreenSource?.type;
        const sourceNameLower = (preferredSource?.name || '').toLowerCase();
        const isWhithinWindow =
          sourceNameLower.includes('whithin') ||
          sourceNameLower.includes('electron');

        selectedScreenSource = null;

        if (!preferredSource) {
          callback({ video: null, audio: null });
          return;
        }

        let audioSource = null;
        if (shouldCaptureAudio) {
          if (selectedSourceType === 'window' && !isWhithinWindow) {
            // Захват звука только выбранного окна.
            audioSource = preferredSource;
          } else if (selectedSourceType === 'screen') {
            // Для полного экрана нужен loopback, иначе аудио-трек не создаётся.
            audioSource = 'loopback';
          }
        }

        callback({
          video: preferredSource,
          // Защита от петли в звонке: не захватываем звук, если шарим окно самого Whithin.
          audio: audioSource
        });
      } catch (error) {
        console.error('Display media request failed:', error);
        callback({ video: null, audio: null });
      }
    },
    { useSystemPicker: true }
  );

  createWindow();
  createTray();

  app.on('activate', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      showMainWindow();
    } else if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
  });
}

ipcMain.handle('electron:open-external', async (_, url) => {
  await shell.openExternal(url);
});

ipcMain.on('electron:window-minimize', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win && !win.isDestroyed()) {
    win.minimize();
  }
});

ipcMain.on('electron:window-toggle-maximize', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win || win.isDestroyed()) {
    return;
  }
  if (win.isMaximized()) {
    win.unmaximize();
  } else {
    win.maximize();
  }
});

ipcMain.on('electron:window-close', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win && !win.isDestroyed()) {
    win.close();
  }
});

ipcMain.handle('electron:update-global-shortcuts', (_, shortcuts) => {
  registerGlobalShortcuts(shortcuts);
});

ipcMain.handle('electron:choose-screen-source', async () => {
  const sources = await desktopCapturer.getSources({
    types: ['screen', 'window'],
    thumbnailSize: { width: 320, height: 180 }
  });

  if (!sources.length || !mainWindow) {
    return null;
  }

  const selection = await openScreenPickerWindow(sources);
  if (!selection?.id) {
    return null;
  }

  selectedScreenSource = {
    id: selection.id,
    type: selection.type,
    captureAudio: Boolean(selection.captureAudio)
  };

  return {
    id: selection.id,
    name: selection.name,
    type: selection.type,
    captureAudio: Boolean(selection.captureAudio)
  };
});

ipcMain.on('electron:register-shortcut-listener', (event) => {
  shortcutCallbackWebContents = event.sender;
});

ipcMain.on('electron:remove-shortcut-listener', (event) => {
  if (shortcutCallbackWebContents && shortcutCallbackWebContents.id === event.sender.id) {
    shortcutCallbackWebContents = null;
  }
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  // Win/Linux: окно скрывается в трей, не выходим из процесса
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  if (tray) {
    tray.destroy();
    tray = null;
  }
});
