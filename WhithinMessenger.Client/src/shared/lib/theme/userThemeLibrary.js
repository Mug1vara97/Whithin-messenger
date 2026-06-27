import { THEME_PRESET_IDS, THEME_PRESETS, getThemePresetId } from './themePresets';

export const USER_THEME_LIBRARY_STORAGE_KEY = 'whithin-user-theme-library';
export const USER_THEME_LIBRARY_CHANGED_EVENT = 'userThemeLibraryChanged';

const ALWAYS_INSTALLED = new Set([THEME_PRESET_IDS.DEFAULT]);

function parseLibrary(raw) {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed.filter((id) => typeof id === 'string' && THEME_PRESETS[id]);
  } catch {
    return null;
  }
}

function normalizeLibrary(ids) {
  const unique = [...new Set(ids.filter((id) => THEME_PRESETS[id]))];
  ALWAYS_INSTALLED.forEach((id) => {
    if (!unique.includes(id)) unique.unshift(id);
  });
  return unique;
}

function persistLibrary(ids) {
  const normalized = normalizeLibrary(ids);
  localStorage.setItem(USER_THEME_LIBRARY_STORAGE_KEY, JSON.stringify(normalized));
  window.dispatchEvent(new CustomEvent(USER_THEME_LIBRARY_CHANGED_EVENT, { detail: { ids: normalized } }));
  return normalized;
}

export function getInstalledThemeIds() {
  const saved = parseLibrary(localStorage.getItem(USER_THEME_LIBRARY_STORAGE_KEY));
  if (saved) {
    return normalizeLibrary(saved);
  }

  const current = getThemePresetId();
  const initial = normalizeLibrary([
    THEME_PRESET_IDS.DEFAULT,
    THEME_PRESET_IDS.WHITHIN,
    current,
  ]);
  localStorage.setItem(USER_THEME_LIBRARY_STORAGE_KEY, JSON.stringify(initial));
  return initial;
}

export function getInstalledThemePresets() {
  const ids = getInstalledThemeIds();
  return ids.map((id) => THEME_PRESETS[id]).filter(Boolean);
}

export function isThemeInstalled(presetId) {
  return getInstalledThemeIds().includes(presetId);
}

export function addThemeToLibrary(presetId) {
  if (!THEME_PRESETS[presetId]) return getInstalledThemeIds();
  const next = [...getInstalledThemeIds()];
  if (!next.includes(presetId)) {
    next.push(presetId);
  }
  return persistLibrary(next);
}

export function removeThemeFromLibrary(presetId) {
  if (ALWAYS_INSTALLED.has(presetId)) {
    return getInstalledThemeIds();
  }
  const next = getInstalledThemeIds().filter((id) => id !== presetId);
  return persistLibrary(next);
}

export function subscribeUserThemeLibrary(onChange) {
  if (typeof window === 'undefined') return () => {};

  const handler = (event) => {
    onChange(event.detail?.ids ?? getInstalledThemeIds());
  };

  window.addEventListener(USER_THEME_LIBRARY_CHANGED_EVENT, handler);
  return () => window.removeEventListener(USER_THEME_LIBRARY_CHANGED_EVENT, handler);
}
