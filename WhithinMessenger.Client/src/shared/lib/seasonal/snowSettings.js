const ENABLED_STORAGE_KEY = 'whithinSnowEnabled';
export const SNOW_SETTINGS_EVENT = 'snowSettingsChanged';

/** Snow falls from December 1 through the last day of February (local time). */
export function isSnowSeason(date = new Date()) {
  const month = date.getMonth();
  return month === 11 || month === 0 || month === 1;
}

export function isDesktopApp() {
  return typeof window !== 'undefined' && Boolean(window.electronAPI?.isElectron || window.electronAPI?.isTauri);
}

/** Dev builds ignore the calendar so the effect can be checked any time. */
export function isSnowAvailable(date = new Date()) {
  return isDesktopApp() && (import.meta.env.DEV || isSnowSeason(date));
}

export function getSnowEnabled() {
  if (typeof window === 'undefined') return true;
  const saved = localStorage.getItem(ENABLED_STORAGE_KEY);
  return saved == null ? true : saved === 'true';
}

export function setSnowEnabled(enabled) {
  if (typeof window === 'undefined') return;
  const value = Boolean(enabled);
  localStorage.setItem(ENABLED_STORAGE_KEY, String(value));
  window.dispatchEvent(new CustomEvent(SNOW_SETTINGS_EVENT, { detail: { enabled: value } }));
}
