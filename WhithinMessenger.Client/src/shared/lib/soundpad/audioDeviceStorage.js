const STORAGE_KEY = 'whithinAudioDevices';

const defaultConfig = () => ({
  /** Always in-app mixer — VB-Cable mode removed. */
  soundpadMode: 'inApp',
});

function normalizeConfig(raw) {
  const next = { ...defaultConfig(), ...raw };
  if (next.soundpadMode !== 'inApp') {
    next.soundpadMode = 'inApp';
  }
  return next;
}

export const audioDeviceStorage = {
  getConfig() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultConfig();
      const parsed = normalizeConfig(JSON.parse(raw));
      if (parsed.soundpadMode !== JSON.parse(raw).soundpadMode) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
      }
      return parsed;
    } catch {
      return defaultConfig();
    }
  },

  saveConfig(patch) {
    const next = normalizeConfig({ ...this.getConfig(), ...patch });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent('audioDeviceConfigChanged', { detail: next }));
    return next;
  },
};
