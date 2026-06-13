const STORAGE_KEYS = {
  enabled: 'inAppNotificationsEnabled',
  position: 'desktopNotificationPosition',
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
