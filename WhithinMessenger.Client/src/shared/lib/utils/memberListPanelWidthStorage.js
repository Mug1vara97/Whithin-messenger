const STORAGE_KEY = 'memberListPanelWidth';
const DEFAULT_WIDTH = 240;
const MIN_WIDTH = 200;
const MAX_WIDTH = 420;

export const memberListPanelWidthStorage = {
  get() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = Number.parseInt(raw, 10);
      if (Number.isFinite(parsed)) {
        return Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, parsed));
      }
    } catch {
      // ignore
    }
    return DEFAULT_WIDTH;
  },

  set(width) {
    const clamped = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, Math.round(width)));
    try {
      localStorage.setItem(STORAGE_KEY, String(clamped));
    } catch {
      // ignore
    }
    return clamped;
  },

  min: MIN_WIDTH,
  max: MAX_WIDTH,
  default: DEFAULT_WIDTH,
};
