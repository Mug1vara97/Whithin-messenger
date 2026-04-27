const path = require('node:path');
const { app, BrowserWindow, ipcMain, shell, desktopCapturer, session, globalShortcut } = require('electron');

const rendererUrl = process.env.WEB_CLIENT_URL || 'https://whithin.ru';

let mainWindow = null;
let shortcutCallbackWebContents = null;
let selectedScreenSource = null;

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
        // Audio can be shared only for app windows, never for full-screen share.
        canShareAudio: sourceType === 'window' && !isWhithinWindow
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

function registerGlobalShortcuts(shortcuts = {}) {
  globalShortcut.unregisterAll();

  Object.entries(shortcuts).forEach(([action, accelerator]) => {
    if (!accelerator) {
      return;
    }

    const registered = globalShortcut.register(accelerator, () => {
      if (!shortcutCallbackWebContents || shortcutCallbackWebContents.isDestroyed()) {
        return;
      }
      shortcutCallbackWebContents.send('global-shortcut-triggered', action);
    });

    if (!registered) {
      console.warn(`Failed to register shortcut "${accelerator}" for action "${action}"`);
    }
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false
    }
  });

  mainWindow.loadURL(rendererUrl);

  mainWindow.on('closed', () => {
    mainWindow = null;
    shortcutCallbackWebContents = null;
  });
}

app.whenReady().then(() => {
  session.defaultSession.setDisplayMediaRequestHandler(
    async (request, callback) => {
      let callbackSent = false;
      const safeCallback = (payload) => {
        if (callbackSent) return;
        callbackSent = true;
        callback(payload);
      };

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

        if (!preferredSource) {
          safeCallback({ video: null, audio: null });
          return;
        }

        let audioSource = null;
        if (shouldCaptureAudio && !isWhithinWindow) {
          // Electron accepts "loopback"/"loopbackWithMute" for audio, not DesktopCapturerSource.
          // Keep audio only for app-window sharing and disable for full-screen sharing.
          audioSource = selectedSourceType === 'window' ? 'loopback' : null;
        }

        safeCallback({
          video: preferredSource,
          // Защита от петли в звонке: не захватываем звук, если шарим окно самого Whithin.
          audio: audioSource
        });
      } catch (error) {
        console.error('Display media request failed:', error);
        safeCallback({ video: null, audio: null });
      }
    },
    { useSystemPicker: true }
  );

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

ipcMain.handle('electron:open-external', async (_, url) => {
  await shell.openExternal(url);
});

ipcMain.handle('electron:update-global-shortcuts', (_, shortcuts) => {
  registerGlobalShortcuts(shortcuts);
});

ipcMain.handle('electron:disable-selected-screen-audio', () => {
  if (selectedScreenSource) {
    selectedScreenSource.captureAudio = false;
  }
  return true;
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
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});
