const path = require('node:path');
const { app, BrowserWindow, ipcMain, shell, desktopCapturer, session, globalShortcut, dialog } = require('electron');

const rendererUrl = process.env.WEB_CLIENT_URL || 'https://whithin.ru';

let mainWindow = null;
let shortcutCallbackWebContents = null;
let selectedScreenSource = null;

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
      try {
        const sources = await desktopCapturer.getSources({
          types: ['screen', 'window'],
          thumbnailSize: { width: 320, height: 180 }
        });

        const preferredSource = selectedScreenSource?.id
          ? sources.find((source) => source.id === selectedScreenSource.id)
          : sources.find((source) => source.name.toLowerCase().includes('screen')) || sources[0];

        const shouldCaptureAudio = Boolean(selectedScreenSource?.captureAudio);
        const sourceNameLower = (preferredSource?.name || '').toLowerCase();
        const isWhithinWindow =
          sourceNameLower.includes('whithin') ||
          sourceNameLower.includes('electron');

        selectedScreenSource = null;

        if (!preferredSource) {
          callback({ video: null, audio: null });
          return;
        }

        callback({
          video: preferredSource,
          // Защита от петли в звонке: не захватываем звук, если шарим окно самого Whithin.
          audio: shouldCaptureAudio && !isWhithinWindow ? 'loopback' : null
        });
      } catch (error) {
        console.error('Display media request failed:', error);
        callback({ video: null, audio: null });
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

ipcMain.handle('electron:choose-screen-source', async () => {
  const sources = await desktopCapturer.getSources({
    types: ['screen', 'window'],
    thumbnailSize: { width: 320, height: 180 }
  });

  if (!sources.length || !mainWindow) {
    return null;
  }

  const sourceButtons = sources.slice(0, 9).map((source, index) => {
    const normalizedName = source.name?.trim() || `Source ${index + 1}`;
    const sourceType = source.id.startsWith('screen:') ? 'Screen' : 'Window';
    return `${index + 1}. [${sourceType}] ${normalizedName}`;
  });

  const result = await dialog.showMessageBox(mainWindow, {
    type: 'question',
    buttons: [...sourceButtons, 'Cancel'],
    cancelId: sourceButtons.length,
    defaultId: 0,
    title: 'Choose source for screen sharing',
    message: 'Select a screen or window to share'
  });

  if (result.response >= sourceButtons.length) {
    return null;
  }

  const selectedSource = sources[result.response];
  const sourceType = selectedSource.id.startsWith('screen:') ? 'screen' : 'window';
  const sourceNameLower = (selectedSource.name || '').toLowerCase();
  const isWhithinWindow = sourceNameLower.includes('whithin') || sourceNameLower.includes('electron');

  let captureAudio = false;
  if (!isWhithinWindow) {
    const audioResult = await dialog.showMessageBox(mainWindow, {
      type: 'question',
      buttons: ['Share with audio', 'Share without audio'],
      cancelId: 1,
      defaultId: 0,
      title: 'Screen share audio',
      message: 'Include system audio in screen sharing?'
    });
    captureAudio = audioResult.response === 0;
  }

  selectedScreenSource = {
    id: selectedSource.id,
    captureAudio
  };

  return {
    id: selectedSource.id,
    name: selectedSource.name,
    type: sourceType,
    captureAudio
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
