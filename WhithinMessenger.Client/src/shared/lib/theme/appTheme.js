import {
  THEME_PRESET_STORAGE_KEY,
  THEME_PRESET_IDS,
  THEME_PRESETS,
  applyThemePresetAttribute,
  getBaseThemeForPreset,
  getThemePresetId,
} from './themePresets';

const STORAGE_KEY = 'whithin-app-theme';
const PREVIEW_KEY = 'whithin-app-theme-preview';

export const THEME_WINDOW_MESSAGE = {
  SAVED: 'whithin-theme-saved',
  CANCEL: 'whithin-theme-cancel',
  RESET: 'whithin-theme-reset',
};

/** Базовая тема (совпадает с :root в index.css). Для ключей с acceptsGradient допускается linear-gradient(...). */
export const DEFAULT_THEME = {
  '--background': '#36393f',
  '--background-primary': '#2f3136',
  '--background-secondary': '#36393f',
  '--surface': '#2f3136',
  '--surface-hover': '#40444b',
  '--text': '#dcddde',
  '--text-muted': '#8e9297',
  '--text-secondary': '#b9bbbe',
  '--primary': '#5865f2',
  '--primary-hover': '#4752c4',
  '--border': '#4f545c',
  '--server-list-background': '#1e1f22'
};

/** acceptsGradient: linear-gradient, сферный mesh (несколько radial-gradient) или свой CSS background. */
export const THEME_COLOR_FIELDS = [
  { key: '--background', label: 'Фон приложения', acceptsGradient: true },
  { key: '--background-primary', label: 'Фон панелей', acceptsGradient: true },
  { key: '--background-secondary', label: 'Фон вторичный', acceptsGradient: true },
  { key: '--surface', label: 'Поверхности', acceptsGradient: true },
  { key: '--surface-hover', label: 'Наведение на элементы', acceptsGradient: true },
  { key: '--text', label: 'Текст', acceptsGradient: false },
  { key: '--text-muted', label: 'Приглушённый текст', acceptsGradient: false },
  { key: '--text-secondary', label: 'Вторичный текст', acceptsGradient: false },
  { key: '--primary', label: 'Акцент (кнопки, ссылки)', acceptsGradient: true },
  { key: '--primary-hover', label: 'Акцент при наведении', acceptsGradient: true },
  { key: '--border', label: 'Границы', acceptsGradient: false },
  { key: '--server-list-background', label: 'Полоса серверов', acceptsGradient: true }
];

/** Первый #rrggbb / #rgb в строке (для color input и rgba). */
export function extractFirstHexFromThemeValue(value) {
  if (!value || typeof value !== 'string') return null;
  const s = value.trim();
  const m = s.match(/#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/);
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) {
    h = h.split('').map((c) => c + c).join('');
  }
  if (h.length !== 6) return null;
  return `#${h}`;
}

function hexToRgbTriplet(hex) {
  const normalized = extractFirstHexFromThemeValue(hex) || (typeof hex === 'string' && hex.startsWith('#') ? hex : null);
  if (!normalized) return '88, 101, 242';
  let h = normalized.replace('#', '');
  if (h.length === 3) {
    h = h.split('').map((c) => c + c).join('');
  }
  if (h.length !== 6) return '88, 101, 242';
  const n = parseInt(h, 16);
  if (Number.isNaN(n)) return '88, 101, 242';
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
}

export const THEME_RGB_VAR_MAP = [
  ['--background-rgb', '--background'],
  ['--background-primary-rgb', '--background-primary'],
  ['--background-secondary-rgb', '--background-secondary'],
  ['--surface-rgb', '--surface'],
  ['--server-list-background-rgb', '--server-list-background'],
];

function parseColorRgbTriplet(raw) {
  if (!raw) {
    return null;
  }

  const hex = extractFirstHexFromThemeValue(raw);
  if (hex) {
    return hexToRgbTriplet(hex);
  }

  const rgbaMatch = raw.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (rgbaMatch) {
    return `${rgbaMatch[1]}, ${rgbaMatch[2]}, ${rgbaMatch[3]}`;
  }

  return null;
}

/** RGB triplets for frosted-glass rgba(var(--*-rgb), alpha) overlays. */
export function applyThemeRgbVars(root, theme) {
  if (typeof document === 'undefined' || !root) {
    return;
  }

  const merged = { ...DEFAULT_THEME, ...theme };
  THEME_RGB_VAR_MAP.forEach(([rgbVar, themeKey]) => {
    root.style.removeProperty(rgbVar);
    const rgb = parseColorRgbTriplet(merged[themeKey]);
    if (rgb) {
      root.style.setProperty(rgbVar, rgb);
    }
  });
}

function notifyThemeColorsChanged() {
  if (typeof window === 'undefined') {
    return;
  }
  window.dispatchEvent(new CustomEvent('themeColorsChanged'));
}

function hexLuminance(hex) {
  const normalized = extractFirstHexFromThemeValue(hex);
  if (!normalized) return 0.5;
  const n = parseInt(normalized.replace('#', ''), 16);
  const channels = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((value) => {
    const channel = value / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function resolveTextOnPrimary(theme) {
  if (theme['--text-on-primary']) return theme['--text-on-primary'];
  const primaryLuminance = hexLuminance(theme['--primary']);
  return primaryLuminance > 0.55 ? '#0a0a0a' : '#ffffff';
}

export function getMergedTheme() {
  const presetId = getThemePresetId();
  const base = getBaseThemeForPreset(presetId, DEFAULT_THEME);
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return base;
    const saved = JSON.parse(raw);
    if (saved && typeof saved === 'object') {
      Object.keys(DEFAULT_THEME).forEach((k) => {
        if (saved[k] != null && saved[k] !== '') base[k] = saved[k];
      });
    }
    if (
      presetId === THEME_PRESET_IDS.LIGHT_CREAM &&
      (base['--primary'] === '#e60012' || base['--primary-hover'] === '#b8000e')
    ) {
      const presetColors = THEME_PRESETS[THEME_PRESET_IDS.LIGHT_CREAM].colors;
      base['--primary'] = presetColors['--primary'];
      base['--primary-hover'] = presetColors['--primary-hover'];
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...saved, ...base }));
    }
    if (presetId === THEME_PRESET_IDS.NIGHT_CITY) {
      const nc = THEME_PRESETS[THEME_PRESET_IDS.NIGHT_CITY].colors;
      base['--text'] = nc['--text'];
      base['--text-muted'] = nc['--text-muted'];
      base['--text-secondary'] = nc['--text-secondary'];
    }
    if (presetId === THEME_PRESET_IDS.CYBERPUNK) {
      const cp = THEME_PRESETS[THEME_PRESET_IDS.CYBERPUNK].colors;
      base['--text'] = cp['--text'];
      base['--text-muted'] = cp['--text-muted'];
      base['--text-secondary'] = cp['--text-secondary'];
      base['--icon'] = cp['--icon'];
      base['--icon-hover'] = cp['--icon-hover'];
      if (base['--background'] === '#0c0814' || base['--text'] === '#e8192e') {
        Object.assign(base, cp);
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...(saved || {}), ...base }));
      }
    }
  } catch {
    /* ignore */
  }
  return base;
}

export function persistThemePreset(presetId) {
  const id = THEME_PRESETS[presetId] ? presetId : THEME_PRESET_IDS.DEFAULT;
  localStorage.setItem(THEME_PRESET_STORAGE_KEY, id);
  const colors = getBaseThemeForPreset(id, DEFAULT_THEME);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(colors));
  clearThemePreview();
  applyThemePresetAttribute(id);
  applyThemeToRoot(colors);
  window.dispatchEvent(new CustomEvent('themePresetChanged', { detail: { presetId: id } }));
}

export { getThemePresetId, THEME_PRESET_LIST, THEME_PRESET_IDS } from './themePresets';

export function applyThemeToRoot(theme) {
  const root = document.documentElement;
  const merged = { ...DEFAULT_THEME, ...theme };
  Object.keys(merged).forEach((key) => {
    const value = merged[key];
    if (value) root.style.setProperty(key, value);
  });
  const primary = merged['--primary'];
  if (primary) {
    root.style.setProperty('--primary-rgb', hexToRgbTriplet(primary));
  }
  const surfaceHover = merged['--surface-hover'];
  if (surfaceHover) {
    root.style.setProperty('--hover', surfaceHover);
    root.style.setProperty('--background-modifier-hover', surfaceHover);
  }
  const bg = merged['--background'];
  if (bg) {
    root.style.setProperty('--bottom', bg);
  }
  const textColor = merged['--text'];
  if (textColor) {
    root.style.setProperty('--text-normal', textColor);
  }
  root.style.setProperty('--icon', merged['--icon'] || merged['--text-secondary'] || merged['--text']);
  root.style.setProperty('--icon-hover', merged['--icon-hover'] || merged['--text']);
  root.style.setProperty('--text-on-primary', resolveTextOnPrimary(merged));
  applyThemeRgbVars(root, merged);
}

export function applySavedTheme() {
  applyThemePresetAttribute(getThemePresetId());
  applyThemeToRoot(getMergedTheme());
}

export function persistTheme(partial) {
  const next = { ...getMergedTheme(), ...partial };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  clearThemePreview();
  applyThemeToRoot(next);
  notifyThemeColorsChanged();
}

export function resetTheme() {
  localStorage.removeItem(STORAGE_KEY);
  clearThemePreview();
  applyThemePresetAttribute(getThemePresetId());
  applyThemeToRoot(getMergedTheme());
  notifyThemeColorsChanged();
}

/** Предпросмотр в основном окне, пока редактор открыт в отдельном. */
export function broadcastThemePreview(theme) {
  try {
    localStorage.setItem(
      PREVIEW_KEY,
      JSON.stringify({ ...theme, __previewTs: Date.now() }),
    );
  } catch {
    /* ignore quota */
  }
}

export function clearThemePreview() {
  try {
    localStorage.removeItem(PREVIEW_KEY);
  } catch {
    /* ignore */
  }
}

export function notifyOpenerThemeMessage(type) {
  if (!window.opener || window.opener.closed) return;
  try {
    window.opener.postMessage({ type }, window.location.origin);
  } catch {
    /* ignore */
  }
}

export function setupThemeWindowSync() {
  const onStorage = (event) => {
    if (event.key === PREVIEW_KEY && event.newValue) {
      try {
        const parsed = JSON.parse(event.newValue);
        const { __previewTs, ...theme } = parsed;
        applyThemeToRoot({ ...DEFAULT_THEME, ...theme });
        notifyThemeColorsChanged();
      } catch {
        /* ignore */
      }
      return;
    }
    if (event.key === PREVIEW_KEY && !event.newValue) {
      applyThemeToRoot(getMergedTheme());
      notifyThemeColorsChanged();
      return;
    }
    if (event.key === STORAGE_KEY || event.key === THEME_PRESET_STORAGE_KEY) {
      clearThemePreview();
      applyThemePresetAttribute(getThemePresetId());
      applyThemeToRoot(getMergedTheme());
      notifyThemeColorsChanged();
    }
  };

  const onMessage = (event) => {
    if (event.origin !== window.location.origin) return;
    const { type } = event.data || {};
    if (
      type === THEME_WINDOW_MESSAGE.SAVED ||
      type === THEME_WINDOW_MESSAGE.CANCEL ||
      type === THEME_WINDOW_MESSAGE.RESET
    ) {
      clearThemePreview();
      applyThemeToRoot(getMergedTheme());
      notifyThemeColorsChanged();
    }
  };

  window.addEventListener('storage', onStorage);
  window.addEventListener('message', onMessage);
  return () => {
    window.removeEventListener('storage', onStorage);
    window.removeEventListener('message', onMessage);
  };
}
