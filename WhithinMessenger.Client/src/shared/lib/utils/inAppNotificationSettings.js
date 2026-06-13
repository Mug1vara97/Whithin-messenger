const STORAGE_KEYS = {
  enabled: 'inAppNotificationsEnabled',
  position: 'desktopNotificationPosition',
  soundEnabled: 'soundNotificationsEnabled',
  soundVolume: 'notificationSoundVolume',
  legacySystem: 'systemNotificationsEnabled',
  legacyToast: 'toastNotificationsEnabled',
};

export const NOTIFICATION_POSITION_OPTIONS = [
  { id: 'top-right', label: 'Сверху справа' },
  { id: 'top-left', label: 'Сверху слева' },
  { id: 'bottom-right', label: 'Снизу справа' },
  { id: 'bottom-left', label: 'Снизу слева' },
];

export const NOTIFICATION_AUTO_DISMISS_MS = 3 * 60 * 1000;

const VALID_POSITIONS = new Set(NOTIFICATION_POSITION_OPTIONS.map((option) => option.id));

export function getInAppNotificationsEnabled() {
  if (typeof window === 'undefined') return true;

  const saved = localStorage.getItem(STORAGE_KEYS.enabled);
  if (saved != null) {
    return JSON.parse(saved);
  }

  const legacySystem = localStorage.getItem(STORAGE_KEYS.legacySystem);
  if (legacySystem != null) {
    return JSON.parse(legacySystem);
  }

  const legacyToast = localStorage.getItem(STORAGE_KEYS.legacyToast);
  return legacyToast == null ? true : JSON.parse(legacyToast);
}

export function setInAppNotificationsEnabled(enabled) {
  if (typeof window === 'undefined') return;

  const value = Boolean(enabled);
  localStorage.setItem(STORAGE_KEYS.enabled, JSON.stringify(value));
  window.dispatchEvent(
    new CustomEvent('notificationSettingsChanged', {
      detail: { inAppNotificationsEnabled: value },
    }),
  );
}

export function getSoundNotificationsEnabled() {
  if (typeof window === 'undefined') return true;

  const saved = localStorage.getItem(STORAGE_KEYS.soundEnabled);
  return saved == null ? true : JSON.parse(saved);
}

export function setSoundNotificationsEnabled(enabled) {
  if (typeof window === 'undefined') return;

  const value = Boolean(enabled);
  localStorage.setItem(STORAGE_KEYS.soundEnabled, JSON.stringify(value));
  window.dispatchEvent(
    new CustomEvent('notificationSettingsChanged', {
      detail: { soundNotificationsEnabled: value },
    }),
  );
}

export function getNotificationSoundVolume() {
  if (typeof window === 'undefined') return 100;

  const saved = localStorage.getItem(STORAGE_KEYS.soundVolume);
  if (saved == null) return 100;

  const numeric = Number(saved);
  if (!Number.isFinite(numeric)) return 100;
  return Math.min(100, Math.max(0, Math.round(numeric)));
}

export function getNotificationSoundVolumeFactor() {
  return getNotificationSoundVolume() / 100;
}

export function setNotificationSoundVolume(volume) {
  if (typeof window === 'undefined') return;

  const numeric = Number(volume);
  const value = Number.isFinite(numeric)
    ? Math.min(100, Math.max(0, Math.round(numeric)))
    : 100;
  localStorage.setItem(STORAGE_KEYS.soundVolume, String(value));
  window.dispatchEvent(
    new CustomEvent('notificationSettingsChanged', {
      detail: { notificationSoundVolume: value },
    }),
  );
}

export function getNotificationPosition() {
  if (typeof window === 'undefined') return 'top-right';

  const saved = localStorage.getItem(STORAGE_KEYS.position);
  if (saved && VALID_POSITIONS.has(saved)) {
    return saved;
  }

  return 'top-right';
}

export function setNotificationPosition(position) {
  if (typeof window === 'undefined') return;

  const value = VALID_POSITIONS.has(position) ? position : 'top-right';
  localStorage.setItem(STORAGE_KEYS.position, value);
  window.dispatchEvent(
    new CustomEvent('notificationSettingsChanged', {
      detail: { position: value },
    }),
  );
}
