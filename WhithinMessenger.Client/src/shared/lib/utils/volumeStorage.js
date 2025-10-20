// Утилита для сохранения настроек громкости
export class VolumeStorage {
  constructor() {
    this.storageKey = 'voiceCallSettings';
    this.defaultSettings = {
      inputVolume: 1.0,
      outputVolume: 1.0,
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
    return this.getSettings().outputVolume;
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
}

export const volumeStorage = new VolumeStorage();

