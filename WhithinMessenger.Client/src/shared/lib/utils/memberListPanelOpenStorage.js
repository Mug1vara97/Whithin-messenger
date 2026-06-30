const STORAGE_KEY = 'memberListPanelOpen';

export const memberListPanelOpenStorage = {
  get() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw === 'false') return false;
      if (raw === 'true') return true;
    } catch {
      // ignore
    }
    return true;
  },

  set(open) {
    try {
      localStorage.setItem(STORAGE_KEY, open ? 'true' : 'false');
    } catch {
      // ignore
    }
  },
};
