import { NOTIFICATION_POSITION_OPTIONS } from './inAppNotificationSettings';
import {
  getActiveCallOverlayPosition,
  setActiveCallOverlayPosition,
  ACTIVE_CALL_OVERLAY_CORNER_PRESETS,
} from './activeCallOverlaySettings';

const STORAGE_KEY = 'desktopCallOverlayPosition';

export const CALL_OVERLAY_POSITION_OPTIONS = NOTIFICATION_POSITION_OPTIONS;

/** @deprecated Use activeCallOverlaySettings instead */
export function getCallOverlayPosition() {
  return getActiveCallOverlayPosition();
}

/** @deprecated Use activeCallOverlaySettings instead */
export function setCallOverlayPosition(position) {
  if (typeof window === 'undefined') return;

  const value = ACTIVE_CALL_OVERLAY_CORNER_PRESETS.some((option) => option.id === position)
    ? position
    : 'bottom-right';
  localStorage.setItem(STORAGE_KEY, value);
  setActiveCallOverlayPosition(value);
}
