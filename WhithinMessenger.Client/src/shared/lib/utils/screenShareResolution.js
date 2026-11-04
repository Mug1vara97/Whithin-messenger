const RESOLUTION_STORAGE_KEY = 'screenShareResolution';
const FPS_STORAGE_KEY = 'screenShareFps';

/** @typedef {'480p' | '720p' | '1080p' | '1440p'} ScreenShareResolutionId */

export const SCREEN_SHARE_RESOLUTION_OPTIONS = [
  { id: '480p', label: '480p', width: 854, height: 480, maxBitrate: 1_500_000 },
  { id: '720p', label: '720p', width: 1280, height: 720, maxBitrate: 3_500_000 },
  { id: '1080p', label: '1080p', width: 1920, height: 1080, maxBitrate: 6_000_000 },
  { id: '1440p', label: '2K', width: 2560, height: 1440, maxBitrate: 10_000_000 },
];

/** @type {readonly number[]} */
export const SCREEN_SHARE_FPS_OPTIONS = [15, 30, 60];

const BY_ID = Object.fromEntries(
  SCREEN_SHARE_RESOLUTION_OPTIONS.map((option) => [option.id, option]),
);

/**
 * @param {unknown} value
 * @returns {ScreenShareResolutionId}
 */
export function normalizeScreenShareResolution(value) {
  const id = String(value || '').toLowerCase();
  if (id === '2k' || id === '1440') return '1440p';
  if (BY_ID[id]) return /** @type {ScreenShareResolutionId} */ (id);
  return '720p';
}

/**
 * @param {unknown} value
 * @returns {15 | 30 | 60}
 */
export function normalizeScreenShareFps(value) {
  const n = Number(value);
  if (n === 15 || n === 30 || n === 60) return n;
  return 30;
}

/**
 * @param {unknown} resolutionValue
 * @param {unknown} [fpsValue]
 */
export function getScreenShareResolutionPreset(resolutionValue, fpsValue) {
  const base = BY_ID[normalizeScreenShareResolution(resolutionValue)] || BY_ID['720p'];
  const maxFramerate = normalizeScreenShareFps(
    fpsValue === undefined || fpsValue === null || fpsValue === ''
      ? getSavedScreenShareFps()
      : fpsValue,
  );
  // Scale bitrate roughly with fps so 60fps gets more headroom than 15fps.
  const fpsFactor = maxFramerate / 30;
  const maxBitrate = Math.round(base.maxBitrate * Math.min(1.35, Math.max(0.7, fpsFactor)));
  return {
    ...base,
    maxFramerate,
    maxBitrate,
  };
}

export function getSavedScreenShareResolution() {
  try {
    return normalizeScreenShareResolution(localStorage.getItem(RESOLUTION_STORAGE_KEY));
  } catch {
    return '720p';
  }
}

export function getSavedScreenShareFps() {
  try {
    return normalizeScreenShareFps(localStorage.getItem(FPS_STORAGE_KEY));
  } catch {
    return 30;
  }
}

/**
 * @param {unknown} value
 */
export function saveScreenShareResolution(value) {
  const id = normalizeScreenShareResolution(value);
  try {
    localStorage.setItem(RESOLUTION_STORAGE_KEY, id);
  } catch {
    /* ignore */
  }
  return id;
}

/**
 * @param {unknown} value
 */
export function saveScreenShareFps(value) {
  const fps = normalizeScreenShareFps(value);
  try {
    localStorage.setItem(FPS_STORAGE_KEY, String(fps));
  } catch {
    /* ignore */
  }
  return fps;
}
