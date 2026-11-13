import { applyThemeRgbVars, applyThemeToRoot, extractFirstHexFromThemeValue, getMergedTheme, THEME_RGB_VAR_MAP } from './appTheme';

const STORAGE_KEY = 'whithin-app-background';
const CHANGE_EVENT = 'appBackgroundSettingsChanged';
const WALLPAPER_ROOT_ID = 'app-wallpaper-root';

/*
 * The wallpaper itself lives in IndexedDB: localStorage caps out around 5 MB per origin,
 * which a base64 image (especially an animated one) easily exceeds.
 * localStorage keeps only the small settings object.
 */
const IMAGE_DB_NAME = 'whithin-app-background';
const IMAGE_STORE = 'images';
const IMAGE_KEY = 'wallpaper';

/** Object URL of the stored wallpaper for this page, or null. */
let imageUrl = null;

function openImageDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(IMAGE_DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(IMAGE_STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function runImageStore(mode, operation) {
  const db = await openImageDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IMAGE_STORE, mode);
    const request = operation(tx.objectStore(IMAGE_STORE));
    tx.oncomplete = () => {
      db.close();
      resolve(request?.result);
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
    tx.onabort = tx.onerror;
  });
}

const loadStoredImage = () => runImageStore('readonly', (store) => store.get(IMAGE_KEY));
const saveStoredImage = (blob) => runImageStore('readwrite', (store) => store.put(blob, IMAGE_KEY));
const deleteStoredImage = () => runImageStore('readwrite', (store) => store.delete(IMAGE_KEY));

function setImageBlob(blob) {
  if (imageUrl) URL.revokeObjectURL(imageUrl);
  imageUrl = blob ? URL.createObjectURL(blob) : null;
}

const dataUrlToBlob = async (dataUrl) => (await fetch(dataUrl)).blob();

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

function readStoredJson() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function readRawSettings() {
  if (typeof window === 'undefined') {
    return { ...DEFAULT_APP_BACKGROUND_SETTINGS };
  }
  return normalizeSettings(readStoredJson());
}

/** `imageDataUrl` is always the in-memory object URL, never a persisted value. */
function normalizeSettings(value) {
  const source = value && typeof value === 'object' ? value : {};
  const overlayTint = source.overlayTint === FROSTED_GLASS_OVERLAY_TINT.DEFAULT
    ? FROSTED_GLASS_OVERLAY_TINT.DEFAULT
    : FROSTED_GLASS_OVERLAY_TINT.THEME;
  return {
    enabled: Boolean(source.enabled),
    imageDataUrl: imageUrl,
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
  const { imageDataUrl: _image, ...persisted } = settings;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
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

/** Loads the stored wallpaper; moves an old base64 one out of localStorage on the way. */
async function restoreStoredImage() {
  const stored = readStoredJson();
  const legacyDataUrl = typeof stored?.imageDataUrl === 'string' && stored.imageDataUrl.startsWith('data:image/')
    ? stored.imageDataUrl
    : null;

  if (legacyDataUrl) {
    const blob = await dataUrlToBlob(legacyDataUrl);
    await saveStoredImage(blob);
    setImageBlob(blob);
    writeRawSettings(normalizeSettings(stored));
    return;
  }

  const blob = await loadStoredImage();
  if (blob) {
    setImageBlob(blob);
    return;
  }

  if (stored?.electronFilePath && window.electronAPI?.loadBackgroundImage) {
    const loaded = await window.electronAPI.loadBackgroundImage(stored.electronFilePath);
    if (loaded?.dataUrl) {
      const fileBlob = await dataUrlToBlob(loaded.dataUrl);
      await saveStoredImage(fileBlob);
      setImageBlob(fileBlob);
    }
  }
}

export async function applySavedAppBackgroundSettings() {
  try {
    await restoreStoredImage();
  } catch {
    setImageBlob(null);
  }

  const settings = getAppBackgroundSettings();
  if (settings.enabled && !settings.imageDataUrl) {
    return setAppBackgroundSettings({ enabled: false, electronFilePath: null });
  }
  applyAppBackgroundSettings(settings);
  return settings;
}

export function validateBackgroundImageFile(file) {
  if (!file) {
    throw new Error('Файл не выбран');
  }
  if (!file.type.startsWith('image/')) {
    throw new Error('Нужно изображение (JPG, PNG, WebP, GIF)');
  }
}

async function storeImage(blob) {
  try {
    await saveStoredImage(blob);
  } catch {
    throw new Error('Не удалось сохранить фон: не хватает места в хранилище приложения');
  }
  setImageBlob(blob);
}

export async function pickBackgroundImageFromSystem() {
  if (typeof window.electronAPI?.pickBackgroundImage !== 'function') {
    return null;
  }

  const result = await window.electronAPI.pickBackgroundImage();
  if (!result?.dataUrl) {
    return null;
  }

  await storeImage(await dataUrlToBlob(result.dataUrl));
  return setAppBackgroundSettings({
    enabled: true,
    electronFilePath: result.filePath || null,
  });
}

export async function setBackgroundImageFromFile(file) {
  validateBackgroundImageFile(file);
  await storeImage(file);
  return setAppBackgroundSettings({
    enabled: true,
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

  try {
    await deleteStoredImage();
  } catch {
    /* nothing stored */
  }
  setImageBlob(null);
  return setAppBackgroundSettings({
    electronFilePath: null,
    enabled: false,
  });
}

export function hasCustomBackgroundImage() {
  return Boolean(imageUrl);
}
