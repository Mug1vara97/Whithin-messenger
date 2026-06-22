export const NOTIFICATIONS_TOGGLE_PANEL_EVENT = 'notificationsTogglePanel';
export const NOTIFICATIONS_PANEL_STATE_EVENT = 'notificationsPanelState';

/** @deprecated use toggleNotificationsPanel */
export const NOTIFICATIONS_OPEN_PANEL_EVENT = NOTIFICATIONS_TOGGLE_PANEL_EVENT;

export function toggleNotificationsPanel() {
  window.dispatchEvent(new CustomEvent(NOTIFICATIONS_TOGGLE_PANEL_EVENT));
}

/** @deprecated use toggleNotificationsPanel */
export function openNotificationsPanel() {
  toggleNotificationsPanel();
}

export function notifyNotificationsPanelState(isOpen) {
  window.dispatchEvent(
    new CustomEvent(NOTIFICATIONS_PANEL_STATE_EVENT, { detail: { isOpen: Boolean(isOpen) } }),
  );
}
