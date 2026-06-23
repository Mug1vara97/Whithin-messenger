// Утилита для сохранения настроек громкости
export class VolumeStorage {
  constructor() {
    this.storageKey = 'voiceCallSettings';
    this.defaultSettings = {
      inputVolume: 1.0,
      outputVolume: 1.0,
      inputDeviceId: 'default',
      outputDeviceId: 'default',
      micThreshold: 14,
      noiseSuppression: 'medium',
      echoCancellation: true,
      autoGainControl: true
    };
  }

  getSettings() {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        return { ...this.defaultSettings, ...JSON.parse(stored) };
      }
    } catch (error) {
      console.warn('Failed to load volume settings:', error);
    }
    return this.defaultSettings;
  }

  saveSettings(settings) {
    try {
      const currentSettings = this.getSettings();
      const newSettings = { ...currentSettings, ...settings };
      localStorage.setItem(this.storageKey, JSON.stringify(newSettings));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('voiceCallSettingsChanged', { detail: newSettings }),
        );
      }
    } catch (error) {
      console.warn('Failed to save volume settings:', error);
    }
  }

  getInputVolume() {
    return this.getSettings().inputVolume;
  }

  setInputVolume(volume) {
    this.saveSettings({ inputVolume: Math.max(0, Math.min(1, volume)) });
  }

  getOutputVolume() {
    const value = Number(this.getSettings().outputVolume);
    if (!Number.isFinite(value)) return 1;
    return Math.max(0, Math.min(1, value));
  }

  setOutputVolume(volume) {
    this.saveSettings({ outputVolume: Math.max(0, Math.min(1, volume)) });
  }

  getNoiseSuppression() {
    return this.getSettings().noiseSuppression;
  }

  setNoiseSuppression(mode) {
    this.saveSettings({ noiseSuppression: mode });
  }

  getEchoCancellation() {
    return this.getSettings().echoCancellation;
  }

  setEchoCancellation(enabled) {
    this.saveSettings({ echoCancellation: enabled });
  }

  getAutoGainControl() {
    return this.getSettings().autoGainControl;
  }

  setAutoGainControl(enabled) {
    this.saveSettings({ autoGainControl: enabled });
  }

  getInputDeviceId() {
    return this.getSettings().inputDeviceId || 'default';
  }

  setInputDeviceId(deviceId) {
    this.saveSettings({ inputDeviceId: deviceId || 'default' });
  }

  getOutputDeviceId() {
    return this.getSettings().outputDeviceId || 'default';
  }

  setOutputDeviceId(deviceId) {
    this.saveSettings({ outputDeviceId: deviceId || 'default' });
  }

  getMicThreshold() {
    const value = Number(this.getSettings().micThreshold);
    return Number.isFinite(value) ? Math.max(0, Math.min(255, value)) : 14;
  }

  setMicThreshold(threshold) {
    this.saveSettings({
      micThreshold: Math.max(0, Math.min(255, Math.round(threshold))),
    });
  }
}

export const volumeStorage = new VolumeStorage();

