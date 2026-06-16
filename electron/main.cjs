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
const {
  registerDesktopNotificationIpc,
  shutdownDesktopNotifications,
} = require('./desktopNotifications.cjs');
const {
  registerCallOverlayIpc,
  shutdownCallOverlay,
} = require('./callOverlay.cjs');
const {
  registerActiveCallOverlayIpc,
  shutdownActiveCallOverlay,
  dismissActiveCallOverlay,
} = require('./activeCallOverlay.cjs');

app.commandLine.appendSwitch('disable-renderer-backgrounding');

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
const APP_ICON_PNG_PATH = path.join(__dirname, 'app-icon.png');
const APP_ICON_ICO_PATH = path.join(__dirname, 'app-icon.ico');

/** Высота полоски шапки; синхронно с preload.cjs TITLE_BAR_OVERLAY_HEIGHT */
const TITLE_BAR_OVERLAY_HEIGHT = 32;

/** Зона справа: reload + три кнопки окна */
const TITLEBAR_DRAG_RIGHT_RESERVE_PX = 176;

let mainWindow = null;

function createWindowsBadgeOverlay(count) {
  const label = count > 99 ? '99+' : String(count);
  const fontSize = label.length > 2 ? 6 : label.length > 1 ? 7 : 8;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16">
    <circle cx="8" cy="8" r="7.5" fill="#ED4245"/>
    <text x="8" y="11" text-anchor="middle" fill="#FFFFFF" font-size="${fontSize}" font-family="Segoe UI, Arial, sans-serif" font-weight="700">${label}</text>
  </svg>`;
  const image = nativeImage.createFromDataURL(
    `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
  );
  if (image.isEmpty()) {
    return null;
  }
  return image.getSize().width === 16 ? image : image.resize({ width: 16, height: 16 });
}

function setAppBadgeCount(count) {
  const normalized = typeof count === 'number' && count > 0 ? Math.min(Math.floor(count), 9999) : 0;

  try {
    if (typeof app.setBadgeCount === 'function') {
      app.setBadgeCount(normalized);
    }
  } catch (error) {
    console.warn('[badge] setBadgeCount failed:', error);
  }

  if (process.platform !== 'win32') {
    return;
  }

  const win = mainWindow && !mainWindow.isDestroyed() ? mainWindow : null;
  if (!win) {
    return;
  }

  try {
    if (normalized > 0) {
      const overlay = createWindowsBadgeOverlay(normalized);
      if (overlay) {
        win.setOverlayIcon(overlay, `${normalized} непрочитанных`);
      }
    } else {
      win.setOverlayIcon(null, '');
    }
  } catch (error) {
    console.warn('[badge] setOverlayIcon failed:', error);
  }
}
let shortcutCallbackWebContents = null;
let selectedScreenSource = null;
let lastSelectedScreenSource = null;
let tray = null;
let mouseShortcutBindings = [];
let keyboardShortcutBindings = [];
let globalKeyboardListener = null;
/** Windows: низкоуровневый хук для боковых кнопок (Chromium часто не шлёт X1/X2 в before-input-event). */
let win32GlobalMouseEvents = null;
let win32GlobalMouseHookInitialized = false;
let lastShortcutDispatch = { action: null, at: 0 };
const DEFAULT_SHORTCUT_DEDUPE_MS = 200;
/** Дефолты как в hotkeyStorage — main регистрирует до загрузки whithin.ru */
const DEFAULT_VOICE_SHORTCUTS = {
  'toggle-mic': 'F1',
  'toggle-audio': 'F2',
  'toggle-soundpad-panel': 'F3',
};
const RENDERER_HOTKEY_STORAGE_KEY = 'voiceChatHotkeys';
const RENDERER_SOUNDPAD_CONFIG_KEY = 'whithinSoundpadConfig';
const SOUNDPAD_ACTION_PREFIX = 'soundpad:';
/** true — настоящий выход (меню трея); false — крестик сворачивает в трей */
let allowAppQuit = false;
let isQuitting = false;

const ELECTRON_KEY_ALIASES = {
  ArrowUp: 'Up',
  ArrowDown: 'Down',
  ArrowLeft: 'Left',
  ArrowRight: 'Right',
  Escape: 'Esc',
  '/': 'Slash',
  ' ': 'Space',
  Enter: 'Return',
  Delete: 'Delete',
  Backspace: 'Backspace',
  Tab: 'Tab',
  Home: 'Home',
  End: 'End',
  PageUp: 'PageUp',
  PageDown: 'PageDown',
  Insert: 'Insert',
  CapsLock: 'Capslock',
  NumLock: 'Numlock',
  ScrollLock: 'Scrolllock',
  PrintScreen: 'PrintScreen',
  Pause: 'Pause',
  ContextMenu: 'ContextMenu',
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

function parseMouseHotkey(webkit) {
  if (!webkit || typeof webkit !== 'string') {
    return null;
  }

  const parts = webkit
    .split('+')
    .map((p) => p.trim())
    .filter(Boolean);

  if (!parts.length) {
    return null;
  }

  const normalized = parts.map((p) => p.toLowerCase());
  const buttonToken =
    normalized.find((p) => ['mouse4', 'mouse5', 'leftclick', 'middleclick', 'rightclick'].includes(p)) || null;

  if (!buttonToken) {
    return null;
  }

  const buttonMap = {
    mouse4: 'back',
    mouse5: 'forward',
    leftclick: 'left',
    middleclick: 'middle',
    rightclick: 'right'
  };

  return {
    button: buttonMap[buttonToken],
    modifiers: {
      control: normalized.includes('ctrl') || normalized.includes('control'),
      alt: normalized.includes('alt'),
      shift: normalized.includes('shift'),
      meta: normalized.includes('cmd') || normalized.includes('command') || normalized.includes('meta')
    }
  };
}

function normalizeInputMouseButton(input) {
  const b = input?.button;
  if (typeof b === 'number') {
    if (b === 3) return 'back';
    if (b === 4) return 'forward';
    if (b === 0) return 'left';
    if (b === 1) return 'middle';
    if (b === 2) return 'right';
  }
  const raw = String(b ?? '').toLowerCase();
  if (raw === 'back' || raw === 'x1' || raw === 'xbutton1' || raw === 'button4' || raw === '3') return 'back';
  if (raw === 'forward' || raw === 'x2' || raw === 'xbutton2' || raw === 'button5' || raw === '4') return 'forward';
  if (raw === 'left') return 'left';
  if (raw === 'middle') return 'middle';
  if (raw === 'right') return 'right';
  return raw || null;
}

function isMouseShortcutMatch(binding, input) {
  if (!binding || !input) return false;
  const btn = normalizeInputMouseButton(input);
  if (!btn || btn !== binding.button) return false;
  return (
    Boolean(input.control) === Boolean(binding.modifiers.control) &&
    Boolean(input.alt) === Boolean(binding.modifiers.alt) &&
    Boolean(input.shift) === Boolean(binding.modifiers.shift) &&
    Boolean(input.meta) === Boolean(binding.modifiers.meta)
  );
}

const WEB_KEY_TO_LISTENER = {
  ArrowUp: 'UP ARROW',
  ArrowDown: 'DOWN ARROW',
  ArrowLeft: 'LEFT ARROW',
  ArrowRight: 'RIGHT ARROW',
  Escape: 'ESCAPE',
  ' ': 'SPACE',
  Enter: 'RETURN',
  Delete: 'DELETE',
  Backspace: 'BACKSPACE',
  Tab: 'TAB',
  Home: 'HOME',
  End: 'END',
  PageUp: 'PAGE UP',
  PageDown: 'PAGE DOWN',
  Insert: 'INS',
  CapsLock: 'CAPS LOCK',
  NumLock: 'NUM LOCK',
  ScrollLock: 'SCROLL LOCK',
  PrintScreen: 'PRINT SCREEN',
  Pause: 'PAUSE',
};

function webKeyToListenerKeyName(webKey) {
  if (!webKey || typeof webKey !== 'string') {
    return null;
  }
  if (WEB_KEY_TO_LISTENER[webKey]) {
    return WEB_KEY_TO_LISTENER[webKey];
  }
  if (/^F\d+$/i.test(webKey)) {
    return webKey.toUpperCase();
  }
  if (webKey.length === 1) {
    return webKey.toLocaleUpperCase('en-US');
  }
  return webKey.toUpperCase();
}

function parseKeyboardHotkey(webkit) {
  if (!webkit || typeof webkit !== 'string') {
    return null;
  }
  if (parseMouseHotkey(webkit)) {
    return null;
  }

  const parts = webkit
    .split('+')
    .map((p) => p.trim())
    .filter(Boolean);
  if (!parts.length) {
    return null;
  }

  const modifiers = { ctrl: false, alt: false, shift: false, meta: false };
  let keyPart = null;

  for (const part of parts) {
    const lower = part.toLowerCase();
    if (lower === 'ctrl' || lower === 'control') {
      modifiers.ctrl = true;
    } else if (lower === 'alt' || lower === 'altgraph') {
      modifiers.alt = true;
    } else if (lower === 'shift') {
      modifiers.shift = true;
    } else if (lower === 'cmd' || lower === 'meta' || lower === 'command') {
      modifiers.meta = true;
    } else {
      keyPart = part;
    }
  }

  if (!keyPart) {
    return null;
  }

  const listenerKey = webKeyToListenerKeyName(keyPart);
  if (!listenerKey) {
    return null;
  }

  return { listenerKey, modifiers };
}

function isModifierHeld(isDown, kind) {
  if (!isDown || typeof isDown !== 'object') {
    return false;
  }
  switch (kind) {
    case 'ctrl':
      return Boolean(isDown['LEFT CTRL'] || isDown['RIGHT CTRL']);
    case 'alt':
      return Boolean(isDown['LEFT ALT'] || isDown['RIGHT ALT']);
    case 'shift':
      return Boolean(isDown['LEFT SHIFT'] || isDown['RIGHT SHIFT']);
    case 'meta':
      return Boolean(isDown['LEFT META'] || isDown['RIGHT META']);
    default:
      return false;
  }
}

function isKeyboardShortcutMatch(binding, event, isDown) {
  if (!binding || !event || event.state !== 'DOWN') {
    return false;
  }
  if (!event.name || event.name !== binding.listenerKey) {
    return false;
  }
  return (
    isModifierHeld(isDown, 'ctrl') === Boolean(binding.modifiers.ctrl) &&
    isModifierHeld(isDown, 'alt') === Boolean(binding.modifiers.alt) &&
    isModifierHeld(isDown, 'shift') === Boolean(binding.modifiers.shift) &&
    isModifierHeld(isDown, 'meta') === Boolean(binding.modifiers.meta)
  );
}

/** Совпадение клавиатурного шортката в focused-окне (before-input-event). */
function isBeforeInputKeyboardMatch(binding, input) {
  if (!binding || !input || input.type !== 'keyDown') {
    return false;
  }
  const listenerKey = webKeyToListenerKeyName(input.key);
  if (!listenerKey || listenerKey !== binding.listenerKey) {
    return false;
  }
  return (
    Boolean(input.control) === Boolean(binding.modifiers.ctrl) &&
    Boolean(input.alt) === Boolean(binding.modifiers.alt) &&
    Boolean(input.shift) === Boolean(binding.modifiers.shift) &&
    Boolean(input.meta) === Boolean(binding.modifiers.meta)
  );
}

function getWinKeyServerPath() {
  const candidates = [];
  try {
    const pkgRoot = path.dirname(require.resolve('node-global-key-listener/package.json'));
    candidates.push(path.join(pkgRoot, 'bin', 'WinKeyServer.exe'));
  } catch (_) {
    /* ignore */
  }

  if (app.isPackaged) {
    candidates.push(
      path.join(
        process.resourcesPath,
        'app.asar.unpacked',
        'node_modules',
        'node-global-key-listener',
        'bin',
        'WinKeyServer.exe'
      )
    );
  }

  for (const candidate of candidates) {
    let resolved = candidate;
    if (
      !fs.existsSync(resolved) &&
      resolved.includes('app.asar') &&
      !resolved.includes('app.asar.unpacked')
    ) {
      resolved = resolved.replace('app.asar', 'app.asar.unpacked');
    }
    if (fs.existsSync(resolved)) {
      return resolved;
    }
  }

  return null;
}

function ensureGlobalKeyboardListener() {
  if (globalKeyboardListener) {
    return globalKeyboardListener;
  }
  try {
    const { GlobalKeyboardListener } = require('node-global-key-listener');
    const serverPath = getWinKeyServerPath();
    const listenerConfig = serverPath ? { windows: { serverPath } } : {};
    if (serverPath) {
      console.log('[shortcuts] WinKeyServer path:', serverPath);
    } else {
      console.warn('[shortcuts] WinKeyServer.exe not found, global keyboard hook disabled');
    }
    globalKeyboardListener = new GlobalKeyboardListener(listenerConfig);
    globalKeyboardListener
      .addListener((event, isDown) => {
        if (!keyboardShortcutBindings.length) {
          return false;
        }
        const matched = keyboardShortcutBindings.find((binding) =>
          isKeyboardShortcutMatch(binding, event, isDown)
        );
        if (matched) {
          dispatchShortcutAction(matched.action);
        }
        return false;
      })
      .catch((err) => {
        console.warn('[shortcuts] failed to start global keyboard listener:', err.message);
        globalKeyboardListener = null;
      });
    return globalKeyboardListener;
  } catch (err) {
    console.warn('[shortcuts] node-global-key-listener unavailable:', err.message);
    return null;
  }
}

function dispatchShortcutAction(action, options = {}) {
  const dedupeMs =
    typeof options.dedupeMs === 'number' ? options.dedupeMs : DEFAULT_SHORTCUT_DEDUPE_MS;
  const now = Date.now();
  if (
    lastShortcutDispatch.action === action &&
    now - lastShortcutDispatch.at < dedupeMs
  ) {
    return false;
  }
  lastShortcutDispatch = { action, at: now };

  const target =
    shortcutCallbackWebContents && !shortcutCallbackWebContents.isDestroyed()
      ? shortcutCallbackWebContents
      : mainWindow && !mainWindow.isDestroyed()
      ? mainWindow.webContents
      : null;

  if (!target || target.isDestroyed()) {
    console.log('[mouse-bind-debug] dispatch skipped: no alive target for action', action);
    return false;
  }

  console.log('[mouse-bind-debug] dispatch action -> renderer:', action, 'targetId:', target.id);
  target.send('global-shortcut-triggered', action);

  // Скрытое/свёрнутое окно: принудительно диспатчим событие в страницу (IPC может откладываться).
  if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) {
    const detail = JSON.stringify(action);
    target
      .executeJavaScript(
        `window.dispatchEvent(new CustomEvent('whithin-global-shortcut',{detail:${detail}}));`,
        true
      )
      .catch(() => {});
  }

  if (action === 'toggle-mic' || action === 'toggle-audio') {
    requestActiveCallOverlaySyncFromRenderer();
  }

  return true;
}

function requestActiveCallOverlaySyncFromRenderer() {
  const target =
    mainWindow && !mainWindow.isDestroyed() ? mainWindow.webContents : null;
  if (!target || target.isDestroyed()) {
    return;
  }

  target.send('electron:force-active-call-overlay-sync');
  setTimeout(() => {
    if (!target.isDestroyed()) {
      target.send('electron:force-active-call-overlay-sync');
    }
  }, 120);
  setTimeout(() => {
    if (!target.isDestroyed()) {
      target.send('electron:force-active-call-overlay-sync');
    }
  }, 350);
}

function getWin32GlobalMouseEvents() {
  if (process.platform !== 'win32') {
    return null;
  }
  if (win32GlobalMouseEvents) {
    return win32GlobalMouseEvents;
  }
  try {
    win32GlobalMouseEvents = require('global-mouse-events');
    return win32GlobalMouseEvents;
  } catch (err) {
    console.warn('[shortcuts] global-mouse-events unavailable (mouse side buttons may not work):', err.message);
    return null;
  }
}

/** Кнопки из пакета global-mouse-events (WM_*BUTTON / XBUTTON через index.js). */
function globalMousePackageButtonToBindingButton(rawButton) {
  const n = Math.round(Number(rawButton));
  if (n === 1) return 'left';
  if (n === 2) return 'right';
  if (n === 3) return 'middle';
  if (n === 4) return 'back';
  if (n === 5) return 'forward';
  return null;
}

function win32GlobalMouseDownHandler(payload) {
  if (!mouseShortcutBindings.length) {
    return;
  }
  const bindingButton = globalMousePackageButtonToBindingButton(payload?.button);
  if (!bindingButton) {
    return;
  }
  const input = {
    type: 'mouseDown',
    button: bindingButton,
    control: false,
    alt: false,
    shift: false,
    meta: false
  };
  const matched = mouseShortcutBindings.find((binding) => isMouseShortcutMatch(binding, input));
  if (matched && dispatchShortcutAction(matched.action, { dedupeMs: 120 })) {
    console.log('[mouse-bind-debug] win32 global hook matched:', matched);
  }
}

function syncWin32GlobalMouseHook() {
  const mod = getWin32GlobalMouseEvents();
  if (!mod) {
    return;
  }
  if (mouseShortcutBindings.length > 0) {
    if (!win32GlobalMouseHookInitialized) {
      mod.on('mousedown', win32GlobalMouseDownHandler);
      win32GlobalMouseHookInitialized = true;
    }
    mod.resumeMouseEvents();
  } else if (win32GlobalMouseHookInitialized) {
    mod.pauseMouseEvents();
  }
}

async function readRendererTheme() {
  const fallback = {
    presetId: 'default',
    themeMode: 'dark',
    vars: {
      bg: '#1e1f22',
      titlebarBg: '#1e1f22',
      surface: '#2b2d31',
      surfaceHover: '#35373c',
      border: '#3f4147',
      primary: '#5865f2',
      text: '#dbdee1',
      textMuted: '#949ba4',
      danger: '#ed4245',
    },
  };

  if (!mainWindow || mainWindow.isDestroyed()) {
    return fallback;
  }

  try {
    return await mainWindow.webContents.executeJavaScript(`(() => {
      const root = document.documentElement;
      const styles = getComputedStyle(root);
      const pick = (name, fallbackValue) => styles.getPropertyValue(name).trim() || fallbackValue;
      return {
        presetId: root.getAttribute('data-theme-preset') || 'default',
        themeMode: root.getAttribute('data-theme-mode') || 'dark',
        vars: {
          bg: pick('--background', '#1e1f22'),
          titlebarBg: pick('--server-list-background') || pick('--background', '#1e1f22'),
          surface: pick('--surface', '#2b2d31'),
          surfaceHover: pick('--surface-highlight', '#35373c'),
          border: pick('--border', '#3f4147'),
          primary: pick('--primary', '#5865f2'),
          text: pick('--text', '#dbdee1'),
          textMuted: pick('--text-muted') || pick('--text-secondary', '#949ba4'),
          titlebarNav: pick('--icon') || pick('--text-secondary', '#9aa1ac'),
          danger: pick('--danger', '#ed4245'),
          cpGlowYellow: pick('--cp-glow-yellow', ''),
          ncTextGlow: pick('--nc-text-glow', ''),
        },
      };
    })()`);
  } catch (error) {
    console.warn('[screen-picker] failed to read renderer theme:', error.message);
    return fallback;
  }
}

function mapScreenPickerSources(sources) {
  return sources.map((source) => {
    const sourceNameLower = (source.name || '').toLowerCase();
    const isWhithinWindow = sourceNameLower.includes('whithin') || sourceNameLower.includes('electron');
    const sourceType = source.id.startsWith('screen:') ? 'screen' : 'window';
    return {
      id: source.id,
      name: source.name,
      type: sourceType,
      thumbnail: source.thumbnail?.toDataURL?.() || null,
      canShareAudio: sourceType === 'screen' || (sourceType === 'window' && !isWhithinWindow),
    };
  });
}

async function openScreenPickerWindow(sources) {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return null;
  }

  const theme = await readRendererTheme();
  const titlebarBg = theme?.vars?.titlebarBg || theme?.vars?.bg || '#1e1f22';

  const pickerWindow = new BrowserWindow({
    width: 920,
    height: 708,
    parent: mainWindow,
    modal: true,
    frame: false,
    resizable: false,
    minimizable: true,
    maximizable: false,
    autoHideMenuBar: true,
    title: 'Демонстрация экрана',
    backgroundColor: titlebarBg,
    webPreferences: {
      preload: path.join(__dirname, 'picker-preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  });

  let isResolved = false;
  let latestSources = sources;
  let resolvePromise;

  const resultPromise = new Promise((resolve) => {
    resolvePromise = resolve;
  });

  const sendInit = async () => {
    if (pickerWindow.isDestroyed()) {
      return;
    }
    const nextTheme = await readRendererTheme();
    pickerWindow.webContents.send('electron:screen-picker-init', {
      sources: mapScreenPickerSources(latestSources),
      theme: nextTheme,
    });
  };

  const cleanup = () => {
    ipcMain.removeListener('electron:screen-picker-submit', handleSubmit);
    ipcMain.removeListener('electron:screen-picker-cancel', handleCancel);
    ipcMain.removeHandler('electron:screen-picker-refresh');
    ipcMain.removeListener('electron:screen-picker-minimize', handleMinimize);
  };

  const closePicker = () => {
    if (!pickerWindow.isDestroyed()) {
      pickerWindow.close();
    }
  };

  const handleSubmit = (_event, data) => {
    if (isResolved) {
      return;
    }
    isResolved = true;
    cleanup();
    closePicker();
    resolvePromise(data);
  };

  const handleCancel = () => {
    if (isResolved) {
      return;
    }
    isResolved = true;
    cleanup();
    closePicker();
    resolvePromise(null);
  };

  const handleMinimize = (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win && !win.isDestroyed()) {
      win.minimize();
    }
  };

  ipcMain.once('electron:screen-picker-submit', handleSubmit);
  ipcMain.once('electron:screen-picker-cancel', handleCancel);
  ipcMain.on('electron:screen-picker-minimize', handleMinimize);
  ipcMain.handle('electron:screen-picker-refresh', async (event) => {
    if (event.sender !== pickerWindow.webContents || pickerWindow.isDestroyed()) {
      return { ok: false };
    }
    latestSources = await desktopCapturer.getSources({
      types: ['screen', 'window'],
      thumbnailSize: { width: 320, height: 180 },
    });
    await sendInit();
    return { ok: true };
  });

  pickerWindow.on('closed', () => {
    if (!isResolved) {
      isResolved = true;
      cleanup();
      resolvePromise(null);
    }
  });

  pickerWindow.webContents.on('did-finish-load', () => {
    sendInit();
  });
  await pickerWindow.loadFile(path.join(__dirname, 'screen-picker.html'));

  return resultPromise;
}

/** Шапка окна рендерится в React (ElectronTitlebar); здесь только хук для совместимости. */
function installCustomTitlebarChrome(_webContents) {}

function buildShortcutsFromRendererStorage(voiceRaw, soundpadRaw) {
  const shortcuts = { ...DEFAULT_VOICE_SHORTCUTS };

  if (voiceRaw) {
    try {
      const voice = JSON.parse(voiceRaw);
      if (voice.toggleMic) shortcuts['toggle-mic'] = voice.toggleMic;
      if (voice.toggleAudio) shortcuts['toggle-audio'] = voice.toggleAudio;
      if (voice.toggleSoundpadPanel) {
        shortcuts['toggle-soundpad-panel'] = voice.toggleSoundpadPanel;
      }
    } catch (err) {
      console.warn('[shortcuts] parse voiceChatHotkeys failed:', err.message);
    }
  }

  if (soundpadRaw) {
    try {
      const config = JSON.parse(soundpadRaw);
      for (const slot of config.slots || []) {
        if (slot.hotkey && slot.soundId) {
          shortcuts[`${SOUNDPAD_ACTION_PREFIX}${slot.id}`] = slot.hotkey;
        }
      }
    } catch (err) {
      console.warn('[shortcuts] parse soundpad config failed:', err.message);
    }
  }

  return shortcuts;
}

async function syncShortcutsFromRendererStorage(webContents) {
  if (!webContents || webContents.isDestroyed()) {
    return;
  }

  try {
    const payload = await webContents.executeJavaScript(
      `(function(){
        var out = { voice: null, soundpad: null };
        try { out.voice = localStorage.getItem(${JSON.stringify(RENDERER_HOTKEY_STORAGE_KEY)}); } catch (e) {}
        try { out.soundpad = localStorage.getItem(${JSON.stringify(RENDERER_SOUNDPAD_CONFIG_KEY)}); } catch (e) {}
        return out;
      })();`,
      true
    );
    const shortcuts = buildShortcutsFromRendererStorage(payload?.voice, payload?.soundpad);
    registerGlobalShortcuts(shortcuts);
    console.log('[shortcuts] synced from renderer localStorage');
  } catch (err) {
    console.warn('[shortcuts] sync from renderer storage failed:', err.message);
  }
}

function registerGlobalShortcuts(shortcuts = {}) {
  mouseShortcutBindings = [];
  keyboardShortcutBindings = [];

  try {
    globalShortcut.unregisterAll();
  } catch (err) {
    console.warn('[shortcuts] globalShortcut.unregisterAll failed:', err.message);
  }

  console.log('[mouse-bind-debug] registerGlobalShortcuts payload:', shortcuts);

  Object.entries(shortcuts).forEach(([action, accelerator]) => {
    if (!accelerator) {
      return;
    }

    const mouseBinding = parseMouseHotkey(String(accelerator));
    if (mouseBinding) {
      mouseShortcutBindings.push({ action, ...mouseBinding });
      console.log('[mouse-bind-debug] mouse binding registered:', {
        action,
        accelerator,
        button: mouseBinding.button,
        modifiers: mouseBinding.modifiers
      });
      return;
    }

    const keyboardBinding = parseKeyboardHotkey(String(accelerator));
    if (keyboardBinding) {
      keyboardShortcutBindings.push({ action, ...keyboardBinding });

      const electronAccel = webHotkeyToElectronAccelerator(String(accelerator));
      let registeredWithGlobalShortcut = false;
      if (electronAccel) {
        try {
          registeredWithGlobalShortcut = globalShortcut.register(electronAccel, () => {
            dispatchShortcutAction(action, { dedupeMs: 150 });
          });
          if (registeredWithGlobalShortcut) {
            console.log('[shortcuts] globalShortcut registered:', { action, electronAccel });
          } else {
            console.warn('[shortcuts] globalShortcut.register returned false:', {
              action,
              electronAccel
            });
          }
        } catch (err) {
          console.warn('[shortcuts] globalShortcut.register error:', action, err.message);
        }
      }

      console.log('[shortcuts] keyboard binding registered:', {
        action,
        accelerator,
        listenerKey: keyboardBinding.listenerKey,
        modifiers: keyboardBinding.modifiers,
        globalShortcut: registeredWithGlobalShortcut
      });
      return;
    }

    if (/Mouse|Click|AuxClick/i.test(String(accelerator))) {
      return;
    }

    console.warn(`[shortcuts] Skip unsupported hotkey for "${action}":`, accelerator);
  });

  // globalShortcut надёжен для F-клавиш; пассивный хук — для Ctrl+Key, букв, стрелок и т.д.
  if (keyboardShortcutBindings.length > 0) {
    ensureGlobalKeyboardListener();
  }

  console.log('[mouse-bind-debug] total mouse bindings:', mouseShortcutBindings.length);
  console.log('[shortcuts] total keyboard bindings:', keyboardShortcutBindings.length);
  syncWin32GlobalMouseHook();
}

function getWindowIconPath() {
  if (process.platform === 'win32' && fs.existsSync(APP_ICON_ICO_PATH)) {
    return APP_ICON_ICO_PATH;
  }
  if (fs.existsSync(APP_ICON_PNG_PATH)) {
    return APP_ICON_PNG_PATH;
  }
  return undefined;
}

function loadIconFromPath(iconPath, size) {
  if (!iconPath) {
    return null;
  }

  const icon = nativeImage.createFromPath(iconPath);
  if (icon.isEmpty()) {
    return null;
  }

  if (!size) {
    return icon;
  }

  const resized = icon.resize({ width: size, height: size, quality: 'best' });
  return resized.isEmpty() ? icon : resized;
}

function getAppIconImage(size) {
  const iconPath = getWindowIconPath();
  return loadIconFromPath(iconPath, size);
}

function getTrayImage() {
  const trayIcon = getAppIconImage(16);
  if (trayIcon) {
    return trayIcon;
  }

  const iconPath = path.join(__dirname, 'tray.png');
  if (fs.existsSync(iconPath)) {
    const img = nativeImage.createFromPath(iconPath);
    if (!img.isEmpty()) {
      return img.resize({ width: 16, height: 16 });
    }
  }

  return nativeImage.createFromDataURL(
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  );
}

function emitMainWindowVisibility() {
  if (!mainWindow || mainWindow.isDestroyed()) return;

  const minimized = mainWindow.isMinimized();
  const visible = mainWindow.isVisible();
  const focused = mainWindow.isFocused();

  try {
    // Главный рендерер питает оверлей и голос — не замедляем его в фоне.
    mainWindow.webContents.setBackgroundThrottling(false);
  } catch (_) {
    /* ignore */
  }

  mainWindow.webContents.send('electron:window-visibility-changed', {
    minimized,
    visible,
    focused,
  });

  if (visible && focused && !minimized) {
    dismissActiveCallOverlay();
  }
}

function applyWindowIcon(win) {
  if (!win || win.isDestroyed()) {
    return;
  }

  const iconPath = getWindowIconPath();
  if (iconPath) {
    win.setIcon(iconPath);
    return;
  }

  const icon = getAppIconImage(process.platform === 'win32' ? 32 : undefined);
  if (icon) {
    win.setIcon(icon);
  }
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
  emitMainWindowVisibility();
}

function hideMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }
  mainWindow.hide();
  emitMainWindowVisibility();
}

function teardownShortcutHooks() {
  try {
    globalShortcut.unregisterAll();
  } catch (_) {
    /* ignore */
  }
  if (globalKeyboardListener) {
    try {
      globalKeyboardListener.kill();
    } catch (_) {}
    globalKeyboardListener = null;
  }
  if (win32GlobalMouseHookInitialized && win32GlobalMouseEvents) {
    try {
      win32GlobalMouseEvents.pauseMouseEvents();
    } catch (_) {}
  }
}

function teardownOverlayWindows() {
  shutdownDesktopNotifications();
  shutdownCallOverlay();
  shutdownActiveCallOverlay();
  setAppBadgeCount(0);
}

function destroyTrayIcon() {
  if (tray) {
    try {
      tray.destroy();
    } catch (_) {}
    tray = null;
  }
}

function destroyAllWindows() {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      try {
        win.destroy();
      } catch (_) {}
    }
  }
  mainWindow = null;
  shortcutCallbackWebContents = null;
}

function quitApplication() {
  if (isQuitting) {
    return;
  }
  isQuitting = true;
  allowAppQuit = true;

  teardownShortcutHooks();
  teardownOverlayWindows();
  destroyTrayIcon();
  destroyAllWindows();
  app.exit(0);
}

function createTray() {
  if (tray) {
    return;
  }
  try {
    const iconPath = getWindowIconPath();
    let icon = iconPath ? nativeImage.createFromPath(iconPath) : getTrayImage();
    if (icon.isEmpty()) {
      icon = getTrayImage();
    }
    if (!icon.isEmpty() && icon.getSize().width !== 16) {
      icon = icon.resize({ width: 16, height: 16, quality: 'best' });
    }
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
            quitApplication();
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
  const iconPath = getWindowIconPath();
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
      sandbox: false,
      backgroundThrottling: false,
    }
  };

  if (iconPath) {
    windowOptions.icon = iconPath;
  } else {
    const appIcon = getAppIconImage(process.platform === 'win32' ? 32 : undefined);
    if (appIcon) {
      windowOptions.icon = appIcon;
    }
  }

  /* Без рамки: свои кнопки «светофор»; thickFrame — края для ресайза на Windows */
  if (process.platform === 'win32' || process.platform === 'linux') {
    windowOptions.frame = false;
    windowOptions.thickFrame = true;
  }

  mainWindow = new BrowserWindow(windowOptions);
  applyWindowIcon(mainWindow);
  mainWindow.webContents.setBackgroundThrottling(false);

  mainWindow.webContents.on('before-input-event', (_event, input) => {
    const key = String(input.key || '').toLowerCase();
    const isToggleDevTools =
      key === 'f12' || ((input.control || input.meta) && input.shift && key === 'i');
    if (isToggleDevTools) {
      if (mainWindow.webContents.isDevToolsOpened()) {
        mainWindow.webContents.closeDevTools();
      } else {
        mainWindow.webContents.openDevTools({ mode: 'detach' });
      }
      return;
    }

    if (input.type === 'keyDown' && keyboardShortcutBindings.length > 0) {
      const matched = keyboardShortcutBindings.find((binding) =>
        isBeforeInputKeyboardMatch(binding, input)
      );
      if (matched && dispatchShortcutAction(matched.action, { dedupeMs: 120 })) {
        _event.preventDefault();
        return;
      }
    }

    const isMouseLikePointer =
      input.type === 'mouseDown' ||
      input.type === 'mouseUp' ||
      input.type === 'pointerDown' ||
      input.type === 'pointerUp';

    if (isMouseLikePointer && mouseShortcutBindings.length > 0) {
      console.log('[mouse-bind-debug] before-input-event mouse:', {
        type: input.type,
        button: input.button,
        normalizedButton: normalizeInputMouseButton(input),
        control: Boolean(input.control),
        alt: Boolean(input.alt),
        shift: Boolean(input.shift),
        meta: Boolean(input.meta)
      });
      const matched = mouseShortcutBindings.find((binding) => isMouseShortcutMatch(binding, input));
      if (matched && dispatchShortcutAction(matched.action, { dedupeMs: 120 })) {
        console.log('[mouse-bind-debug] before-input-event matched binding:', matched);
        _event.preventDefault();
        return;
      }
    }
  });

  mainWindow.on('app-command', (event, command) => {
    if (!mouseShortcutBindings.length) {
      return;
    }

    const cmd = String(command || '').toLowerCase();
    const backCommands = new Set(['browser-backward', 'browser-back', 'backward', 'back']);
    const forwardCommands = new Set(['browser-forward', 'forward']);
    const button = backCommands.has(cmd) ? 'back' : forwardCommands.has(cmd) ? 'forward' : null;
    if (!button) {
      // Не back/forward — к мышиным биндам не относится (часто бывает `unknown` от системы).
      if (cmd && cmd !== 'unknown') {
        console.log('[mouse-bind-debug] app-command ignored (not mouse back/forward):', cmd);
      }
      return;
    }
    console.log('[mouse-bind-debug] app-command mouse navigation:', cmd, '->', button);

    const matched = mouseShortcutBindings.find(
      (binding) =>
        binding.button === button &&
        !binding.modifiers.control &&
        !binding.modifiers.alt &&
        !binding.modifiers.shift &&
        !binding.modifiers.meta
    );

    if (matched && dispatchShortcutAction(matched.action, { dedupeMs: 120 })) {
      console.log('[mouse-bind-debug] app-command matched binding:', matched);
      event.preventDefault();
    }
  });

  attachExternalLinksPolicy(mainWindow.webContents);
  installCustomTitlebarChrome(mainWindow.webContents);

  mainWindow.loadURL(rendererUrl);

  ['minimize', 'restore', 'hide', 'show', 'focus', 'blur'].forEach((eventName) => {
    mainWindow.on(eventName, emitMainWindowVisibility);
  });

  mainWindow.webContents.on('did-finish-load', () => {
    emitMainWindowVisibility();
    syncShortcutsFromRendererStorage(mainWindow.webContents);
  });

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
  if (process.platform === 'win32') {
    app.setAppUserModelId('ru.whithin.desktop');
  }

  app.on('second-instance', () => {
    showMainWindow();
  });

  app.whenReady().then(() => {
  session.defaultSession.setDisplayMediaRequestHandler(
    async (request, callback) => {
      let isCallbackSent = false;
      const safeCallback = (payload) => {
        if (isCallbackSent) return;
        isCallbackSent = true;
        callback(payload);
      };
      try {
        const sources = await desktopCapturer.getSources({
          types: ['screen', 'window'],
          thumbnailSize: { width: 320, height: 180 }
        });

        const now = Date.now();
        const recentSelection =
          lastSelectedScreenSource && now - lastSelectedScreenSource.selectedAt < 15000
            ? lastSelectedScreenSource
            : null;
        const pendingSelection = selectedScreenSource || recentSelection;

        const preferredSource = pendingSelection?.id
          ? sources.find((source) => source.id === pendingSelection.id)
          : sources.find((source) => source.name.toLowerCase().includes('screen')) || sources[0];

        const shouldCaptureAudio = Boolean(pendingSelection?.captureAudio);
        const selectedSourceType = pendingSelection?.type;
        const sourceNameLower = (preferredSource?.name || '').toLowerCase();
        const isWhithinWindow =
          sourceNameLower.includes('whithin') ||
          sourceNameLower.includes('electron');

        selectedScreenSource = null;

        if (!preferredSource) {
          // Deny request without passing invalid null source types.
          safeCallback({});
          return;
        }

        let audioSource = null;
        if (shouldCaptureAudio) {
          if (selectedSourceType === 'window' && !isWhithinWindow) {
            // Для window-поделивания оставляем audio выбранного окна,
            // иначе loopback подмешивает весь системный вывод и эхо звонка.
            audioSource = preferredSource;
          } else if (selectedSourceType === 'screen') {
            // Для полного экрана нужен loopback, иначе аудио-трек не создаётся.
            audioSource = 'loopback';
          }
        }

        safeCallback({
          video: preferredSource,
          // Защита от петли в звонке: не захватываем звук, если шарим окно самого Whithin.
          audio: audioSource
        });
      } catch (error) {
        console.error('Display media request failed:', error);
        // Deny request safely; callback can be called only once.
        safeCallback({});
      }
    },
    { useSystemPicker: true }
  );

  createWindow();
  createTray();
  registerGlobalShortcuts(DEFAULT_VOICE_SHORTCUTS);
  console.log('[shortcuts] default voice shortcuts registered in main process');

  app.on('activate', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      showMainWindow();
    } else if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
  });
}

registerDesktopNotificationIpc(() => mainWindow, showMainWindow);
registerCallOverlayIpc(() => mainWindow, showMainWindow);
registerActiveCallOverlayIpc(() => mainWindow);

ipcMain.handle('electron:open-external', async (_, url) => {
  await shell.openExternal(url);
});

ipcMain.on('electron:window-minimize', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win || win.isDestroyed()) {
    return;
  }
  win.minimize();
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

ipcMain.on('electron:sync-window-background', (event, color) => {
  if (typeof color !== 'string' || !color.trim()) {
    return;
  }
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win || win.isDestroyed()) {
    return;
  }
  try {
    win.setBackgroundColor(color.trim());
  } catch (err) {
    console.warn('electron:sync-window-background failed:', err);
  }
});

ipcMain.on('electron:set-badge-count', (_event, count) => {
  const value = Number(count);
  setAppBadgeCount(Number.isFinite(value) ? value : 0);
});

ipcMain.on('electron:focus-window', () => {
  showMainWindow();
});

ipcMain.on('electron:navigation-back', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win || win.isDestroyed()) {
    return;
  }
  navigateRendererHistory(win, 'back');
});

ipcMain.on('electron:navigation-forward', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win || win.isDestroyed()) {
    return;
  }
  navigateRendererHistory(win, 'forward');
});

ipcMain.on('electron:navigation-reload', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win && !win.isDestroyed()) {
    win.webContents.reload();
  }
});

ipcMain.handle('electron:update-global-shortcuts', (_, shortcuts) => {
  console.log('[mouse-bind-debug] ipc update-global-shortcuts called');
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
  lastSelectedScreenSource = {
    id: selection.id,
    type: selection.type,
    captureAudio: Boolean(selection.captureAudio),
    selectedAt: Date.now()
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
  console.log('[mouse-bind-debug] shortcut listener registered, sender id:', event.sender.id);
});

ipcMain.on('electron:remove-shortcut-listener', (event) => {
  if (shortcutCallbackWebContents && shortcutCallbackWebContents.id === event.sender.id) {
    console.log('[mouse-bind-debug] shortcut listener removed, sender id:', event.sender.id);
    shortcutCallbackWebContents = null;
  }
});

app.on('window-all-closed', () => {
  if (isQuitting) {
    return;
  }
  // Win/Linux: окно скрывается в трей, не выходим из процесса
});

app.on('before-quit', (event) => {
  if (isQuitting) {
    return;
  }
  event.preventDefault();
  quitApplication();
});

app.on('will-quit', () => {
  teardownShortcutHooks();
  teardownOverlayWindows();
  destroyTrayIcon();
});
