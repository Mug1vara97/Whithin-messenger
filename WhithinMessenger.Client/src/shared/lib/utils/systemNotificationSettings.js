const STORAGE_KEYS = {
  enabled: 'systemNotificationsEnabled',
  legacyToastEnabled: 'toastNotificationsEnabled',
};

export function getSystemNotificationsEnabled() {
  if (typeof window === 'undefined') return true;

  const saved = localStorage.getItem(STORAGE_KEYS.enabled);
  if (saved != null) {
    return JSON.parse(saved);
  }

  const legacy = localStorage.getItem(STORAGE_KEYS.legacyToastEnabled);
  return legacy == null ? true : JSON.parse(legacy);
}

export function setSystemNotificationsEnabled(enabled) {
  if (typeof window === 'undefined') return;

  const value = Boolean(enabled);
  localStorage.setItem(STORAGE_KEYS.enabled, JSON.stringify(value));
  window.dispatchEvent(
    new CustomEvent('notificationSettingsChanged', {
      detail: { systemNotificationsEnabled: value },
    }),
  );
}
