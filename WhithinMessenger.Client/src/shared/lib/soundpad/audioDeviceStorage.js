const STORAGE_KEY = 'whithinAudioDevices';

const defaultConfig = () => ({
  captureDeviceId: '',
  renderDeviceId: '',
  /** Virtual mic (CABLE Output) — only for system (VB-Cable) mode */
  virtualMicDeviceId: '',
  bridgeEnabled: false,
  /** inApp = physical mic + Web Audio mixer; system = VB-Cable bridge */
  soundpadMode: 'inApp',
  /** While Whithin is open, set Windows default mic to CABLE Output (system mode). */
  autoDefaultCableMic: true,
});

export const audioDeviceStorage = {
  getConfig() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultConfig();
      return { ...defaultConfig(), ...JSON.parse(raw) };
    } catch {
      return defaultConfig();
    }
  },

  saveConfig(patch) {
    const next = { ...this.getConfig(), ...patch };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent('audioDeviceConfigChanged', { detail: next }));
    return next;
  },

  getVirtualMicDeviceId() {
    return this.getConfig().virtualMicDeviceId || '';
  },
};
