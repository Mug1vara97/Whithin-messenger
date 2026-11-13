const ENABLED_STORAGE_KEY = 'whithinSnowEnabled';
const FORCED_STORAGE_KEY = 'whithinSnowForced';
export const SNOW_SETTINGS_EVENT = 'snowSettingsChanged';

/** Snow falls from December 1 through the last day of February (local time). */
export function isSnowSeason(date = new Date()) {
  const month = date.getMonth();
  return month === 11 || month === 0 || month === 1;
}

export function isDesktopApp() {
  return typeof window !== 'undefined' && Boolean(window.electronAPI?.isElectron || window.electronAPI?.isTauri);
}

const readFlag = (key, fallback) => {
  if (typeof window === 'undefined') return fallback;
  const saved = localStorage.getItem(key);
  return saved == null ? fallback : saved === 'true';
};

const writeFlag = (key, value) => {
  localStorage.setItem(key, String(Boolean(value)));
  window.dispatchEvent(new CustomEvent(SNOW_SETTINGS_EVENT));
};

export const getSnowEnabled = () => readFlag(ENABLED_STORAGE_KEY, true);
export const setSnowEnabled = (enabled) => writeFlag(ENABLED_STORAGE_KEY, enabled);

/** Turned on with the secret hotkey: shows snow outside the season. */
export const getSnowForced = () => readFlag(FORCED_STORAGE_KEY, false);

/** Dev builds ignore the calendar so the effect can be checked any time. */
export function isSnowActive(date = new Date()) {
  if (!isDesktopApp() || !getSnowEnabled()) return false;
  return import.meta.env.DEV || getSnowForced() || isSnowSeason(date);
}

/** Secret hotkey: flips whether snow is shown right now, in or out of season. */
export function toggleSnowSecret() {
  if (isSnowActive()) {
    writeFlag(FORCED_STORAGE_KEY, false);
    if (isSnowActive()) writeFlag(ENABLED_STORAGE_KEY, false);
  } else {
    writeFlag(ENABLED_STORAGE_KEY, true);
    writeFlag(FORCED_STORAGE_KEY, true);
  }
  return isSnowActive();
}

/** Ctrl+Shift+S by physical key, so it works on any keyboard layout. */
export const isSnowHotkey = (event) =>
  event.code === 'KeyS' && (event.ctrlKey || event.metaKey) && event.shiftKey && !event.altKey;
