const COORDS_STORAGE_KEY = 'desktopActiveCallOverlayCoords';
const ENABLED_STORAGE_KEY = 'desktopActiveCallOverlayEnabled';
const LEGACY_POSITION_STORAGE_KEY = 'desktopActiveCallOverlayPosition';

export const ACTIVE_CALL_OVERLAY_CORNER_PRESETS = [
  { id: 'top-left', label: '↖', coords: { xPercent: 0, yPercent: 0 } },
  { id: 'top-right', label: '↗', coords: { xPercent: 100, yPercent: 0 } },
  { id: 'bottom-left', label: '↙', coords: { xPercent: 0, yPercent: 100 } },
  { id: 'bottom-right', label: '↘', coords: { xPercent: 100, yPercent: 100 } },
];

const DEFAULT_COORDS = { xPercent: 100, yPercent: 100 };

function clampPercent(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.min(100, Math.max(0, Math.round(numeric)));
}

function normalizeCoords(coords) {
  if (!coords || typeof coords !== 'object') {
    return { ...DEFAULT_COORDS };
  }

  return {
    xPercent: clampPercent(coords.xPercent),
    yPercent: clampPercent(coords.yPercent),
  };
}

function coordsFromLegacyPosition(position) {
  const preset = ACTIVE_CALL_OVERLAY_CORNER_PRESETS.find((item) => item.id === position);
  return preset ? { ...preset.coords } : { ...DEFAULT_COORDS };
}

function readStoredCoords() {
  if (typeof window === 'undefined') {
    return { ...DEFAULT_COORDS };
  }

  const saved = localStorage.getItem(COORDS_STORAGE_KEY);
  if (saved) {
    try {
      return normalizeCoords(JSON.parse(saved));
    } catch {
      // fall through to legacy migration
    }
  }

  const legacyPosition = localStorage.getItem(LEGACY_POSITION_STORAGE_KEY)
    || localStorage.getItem('desktopCallOverlayPosition');

  if (legacyPosition) {
    return coordsFromLegacyPosition(legacyPosition);
  }

  return { ...DEFAULT_COORDS };
}

export function getActiveCallOverlayEnabled() {
  if (typeof window === 'undefined') return true;

  const saved = localStorage.getItem(ENABLED_STORAGE_KEY);
  if (saved != null) {
    return JSON.parse(saved);
  }

  return true;
}

export function setActiveCallOverlayEnabled(enabled) {
  if (typeof window === 'undefined') return;

  const value = Boolean(enabled);
  localStorage.setItem(ENABLED_STORAGE_KEY, JSON.stringify(value));
  window.dispatchEvent(
    new CustomEvent('activeCallOverlaySettingsChanged', {
      detail: { enabled: value },
    }),
  );
}

export function getActiveCallOverlayCoords() {
  return readStoredCoords();
}

/** @deprecated Use getActiveCallOverlayCoords */
export function getActiveCallOverlayPosition() {
  const coords = getActiveCallOverlayCoords();
  if (coords.xPercent >= 50) {
    return coords.yPercent >= 50 ? 'bottom-right' : 'top-right';
  }
  return coords.yPercent >= 50 ? 'bottom-left' : 'top-left';
}

export function setActiveCallOverlayCoords(coords) {
  if (typeof window === 'undefined') return;

  const value = normalizeCoords(coords);
  localStorage.setItem(COORDS_STORAGE_KEY, JSON.stringify(value));
  window.dispatchEvent(
    new CustomEvent('activeCallOverlaySettingsChanged', {
      detail: { coords: value },
    }),
  );
}

/** @deprecated Use setActiveCallOverlayCoords */
export function setActiveCallOverlayPosition(position) {
  setActiveCallOverlayCoords(coordsFromLegacyPosition(position));
}
