import { applyThemeRgbVars, applyThemeToRoot, extractFirstHexFromThemeValue, getMergedTheme, THEME_RGB_VAR_MAP } from './appTheme';

const STORAGE_KEY = 'whithin-app-background';
const CHANGE_EVENT = 'appBackgroundSettingsChanged';
const WALLPAPER_ROOT_ID = 'app-wallpaper-root';

const MAX_WEB_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_ELECTRON_IMAGE_BYTES = 12 * 1024 * 1024;

/** Wallpaper blur radius when transparent interface mode is active. */
export const FROSTED_GLASS_WALLPAPER_BLUR_PX = 5;

export const FROSTED_GLASS_OVERLAY_TINT = {
  THEME: 'theme',
  DEFAULT: 'default',
};

export const FROSTED_GLASS_OVERLAY_TINT_OPTIONS = [
  {
    id: FROSTED_GLASS_OVERLAY_TINT.THEME,
    label: 'Под цвет темы',
    description: 'Полупрозрачные панели окрашиваются цветами текущей темы.',
  },
  {
    id: FROSTED_GLASS_OVERLAY_TINT.DEFAULT,
    label: 'Нейтральная',
    description: 'Ровное тёмное затемнение панелей без оттенка текущей темы.',
  },
];

export const DEFAULT_APP_BACKGROUND_SETTINGS = {
  enabled: false,
  imageDataUrl: null,
  electronFilePath: null,
  overlayTint: FROSTED_GLASS_OVERLAY_TINT.THEME,
};

function readRawSettings() {
  if (typeof window === 'undefined') {
    return { ...DEFAULT_APP_BACKGROUND_SETTINGS };
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { ...DEFAULT_APP_BACKGROUND_SETTINGS };
    }
    const parsed = JSON.parse(raw);
    return normalizeSettings(parsed);
  } catch {
    return { ...DEFAULT_APP_BACKGROUND_SETTINGS };
  }
}

function normalizeSettings(value) {
  const source = value && typeof value === 'object' ? value : {};
  const overlayTint = source.overlayTint === FROSTED_GLASS_OVERLAY_TINT.DEFAULT
    ? FROSTED_GLASS_OVERLAY_TINT.DEFAULT
    : FROSTED_GLASS_OVERLAY_TINT.THEME;
  return {
    enabled: Boolean(source.enabled),
    imageDataUrl: typeof source.imageDataUrl === 'string' && source.imageDataUrl.trim()
      ? source.imageDataUrl.trim()
      : null,
    electronFilePath: typeof source.electronFilePath === 'string' && source.electronFilePath.trim()
      ? source.electronFilePath.trim()
      : null,
    overlayTint,
  };
}

function writeRawSettings(settings) {
  if (typeof window === 'undefined') {
    return;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}

export function getAppBackgroundSettings() {
  return readRawSettings();
}

export function setAppBackgroundSettings(partial) {
  const next = normalizeSettings({ ...readRawSettings(), ...partial });
  writeRawSettings(next);
  applyAppBackgroundSettings(next);
  return next;
}

export function resetAppBackgroundSettings() {
  writeRawSettings({ ...DEFAULT_APP_BACKGROUND_SETTINGS });
  applyAppBackgroundSettings({ ...DEFAULT_APP_BACKGROUND_SETTINGS });
}

export function subscribeAppBackgroundSettings(callback) {
  if (typeof window === 'undefined') {
    return () => {};
  }
  const handler = () => callback(getAppBackgroundSettings());
  window.addEventListener(CHANGE_EVENT, handler);
  return () => window.removeEventListener(CHANGE_EVENT, handler);
}

/** Inline overrides beat theme vars set via applyThemeToRoot on <html>. */
const FROSTED_INLINE_THEME_KEYS = {
  '--background': 'transparent',
  '--background-primary': 'transparent',
  '--bottom': 'transparent',
  '--server-list-background': 'transparent',
  '--surface': 'transparent',
  '--hover': 'rgb(255, 255, 255, 0.05)',
  '--surface-hover': 'rgb(255, 255, 255, 0.05)',
  '--background-modifier-hover': 'rgb(255, 255, 255, 0.05)',
  '--background-modifier-selected': 'rgb(255, 255, 255, 0.08)',
};

function applyFrostedInlineThemeOverrides(root) {
  Object.entries(FROSTED_INLINE_THEME_KEYS).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });
}

function clearFrostedInlineThemeOverrides(root) {
  Object.keys(FROSTED_INLINE_THEME_KEYS).forEach((key) => {
    root.style.removeProperty(key);
  });
}

function setGlassSurfaceVars(root) {
  applyThemeRgbVars(root, getMergedTheme());
}

function ensureWallpaperRoot() {
  let root = document.getElementById(WALLPAPER_ROOT_ID);
  if (!root) {
    root = document.createElement('div');
    root.id = WALLPAPER_ROOT_ID;
    root.setAttribute('aria-hidden', 'true');

    const image = document.createElement('img');
    image.className = 'app-wallpaper-root__image';
    image.alt = '';
    image.decoding = 'async';
    image.draggable = false;

    const dim = document.createElement('div');
    dim.className = 'app-wallpaper-root__dim';

    root.append(image, dim);
    document.body.prepend(root);
  }

  return root;
}

function updateWallpaperRoot(settings, active) {
  const root = ensureWallpaperRoot();
  if (!active || !settings.imageDataUrl) {
    root.hidden = true;
    return;
  }

  const image = root.querySelector('.app-wallpaper-root__image');
  const dim = root.querySelector('.app-wallpaper-root__dim');
  if (!image || !dim) {
    return;
  }

  root.hidden = false;
  image.src = settings.imageDataUrl;
  image.style.filter = `blur(${FROSTED_GLASS_WALLPAPER_BLUR_PX}px) saturate(1.08)`;
}

function hideWallpaperRoot() {
  const root = document.getElementById(WALLPAPER_ROOT_ID);
  if (root) {
    root.hidden = true;
  }
}

export function resolveElectronWindowBackgroundColor(_isFrostedGlassActive = false) {
  if (typeof document === 'undefined') {
    return '#1e1f22';
  }

  const styles = getComputedStyle(document.documentElement);
  const raw = styles.getPropertyValue('--server-list-background').trim()
    || styles.getPropertyValue('--background').trim();
  return extractFirstHexFromThemeValue(raw) || raw || '#1e1f22';
}

function syncElectronWindowBackground(isFrostedGlassActive) {
  if (typeof window === 'undefined' || !window.electronAPI?.syncWindowBackground) {
    return;
  }

  window.electronAPI.syncWindowBackground(
    resolveElectronWindowBackgroundColor(isFrostedGlassActive),
  );
}

function syncElectronWindowShape(isFrostedGlassActive) {
  if (typeof window === 'undefined' || !window.electronAPI?.syncWindowShape) {
    return;
  }

  window.electronAPI.syncWindowShape({ frostedGlass: isFrostedGlassActive });
}

function clearAppBackgroundDom(root) {
  root.removeAttribute('data-frosted-glass');
  root.removeAttribute('data-frosted-overlay-tint');
  [
    ...THEME_RGB_VAR_MAP.map(([rgbVar]) => rgbVar),
  ].forEach((key) => root.style.removeProperty(key));
  clearFrostedInlineThemeOverrides(root);
  applyThemeToRoot(getMergedTheme());
  document.body?.classList.remove('frosted-glass-active');
  hideWallpaperRoot();
  syncElectronWindowBackground(false);
  syncElectronWindowShape(false);
}

export function applyAppBackgroundSettings(settings = getAppBackgroundSettings()) {
  if (typeof document === 'undefined') {
    return settings;
  }

  const root = document.documentElement;
  const hasImage = Boolean(settings.imageDataUrl);
  const active = settings.enabled && hasImage;

  if (!active) {
    clearAppBackgroundDom(root);
    window.dispatchEvent(new CustomEvent('appBackgroundVisualChanged', { detail: { active: false } }));
    return settings;
  }

  root.setAttribute('data-frosted-glass', 'enabled');
  root.setAttribute(
    'data-frosted-overlay-tint',
    settings.overlayTint === FROSTED_GLASS_OVERLAY_TINT.DEFAULT
      ? FROSTED_GLASS_OVERLAY_TINT.DEFAULT
      : FROSTED_GLASS_OVERLAY_TINT.THEME,
  );
  setGlassSurfaceVars(root);
  applyFrostedInlineThemeOverrides(root);
  document.body.classList.add('frosted-glass-active');
  updateWallpaperRoot(settings, true);
  syncElectronWindowBackground(true);
  syncElectronWindowShape(true);

  window.dispatchEvent(new CustomEvent('appBackgroundVisualChanged', { detail: { active: true } }));
  return settings;
}

export async function applySavedAppBackgroundSettings() {
  let settings = getAppBackgroundSettings();

  if (
    settings.electronFilePath
    && !settings.imageDataUrl
    && window.electronAPI?.loadBackgroundImage
  ) {
    try {
      const loaded = await window.electronAPI.loadBackgroundImage(settings.electronFilePath);
      if (loaded?.dataUrl) {
        settings = setAppBackgroundSettings({
          ...settings,
          imageDataUrl: loaded.dataUrl,
        });
        return settings;
      }
    } catch {
      setAppBackgroundSettings({
        ...settings,
        electronFilePath: null,
        imageDataUrl: null,
        enabled: false,
      });
      return getAppBackgroundSettings();
    }
  }

  applyAppBackgroundSettings(settings);
  return settings;
}

export async function readBackgroundImageFile(file) {
  if (!file) {
    throw new Error('Файл не выбран');
  }
  if (!file.type.startsWith('image/')) {
    throw new Error('Нужно изображение (JPG, PNG, WebP, GIF)');
  }

  const isElectron = Boolean(window.electronAPI?.isElectron);
  const maxBytes = isElectron ? MAX_ELECTRON_IMAGE_BYTES : MAX_WEB_IMAGE_BYTES;
  if (file.size > maxBytes) {
    throw new Error(`Файл слишком большой (максимум ${Math.round(maxBytes / (1024 * 1024))} МБ)`);
  }

  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Не удалось прочитать файл'));
    reader.readAsDataURL(file);
  });

  if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) {
    throw new Error('Неподдерживаемый формат изображения');
  }

  return dataUrl;
}

export async function pickBackgroundImageFromSystem() {
  if (typeof window.electronAPI?.pickBackgroundImage !== 'function') {
    return null;
  }

  const result = await window.electronAPI.pickBackgroundImage();
  if (!result?.dataUrl) {
    return null;
  }

  return setAppBackgroundSettings({
    enabled: true,
    imageDataUrl: result.dataUrl,
    electronFilePath: result.filePath || null,
  });
}

export async function setBackgroundImageFromFile(file) {
  const dataUrl = await readBackgroundImageFile(file);

  return setAppBackgroundSettings({
    enabled: true,
    imageDataUrl: dataUrl,
    electronFilePath: null,
  });
}

export async function clearBackgroundImage() {
  if (typeof window.electronAPI?.clearBackgroundImage === 'function') {
    try {
      await window.electronAPI.clearBackgroundImage();
    } catch {
      /* ignore */
    }
  }

  return setAppBackgroundSettings({
    imageDataUrl: null,
    electronFilePath: null,
    enabled: false,
  });
}

export function hasCustomBackgroundImage() {
  const settings = getAppBackgroundSettings();
  return Boolean(settings.imageDataUrl || settings.electronFilePath);
}
