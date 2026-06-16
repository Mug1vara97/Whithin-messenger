import { soundpadStorage } from './soundpadStorage';
import { soundpadInAppMixer, usesInAppSoundpad } from './soundpadInAppMixer';
import { soundpadLocalMonitor } from './soundpadLocalMonitor';
import { soundpadLog, soundpadWarn } from './soundpadLogger';

const getElectronApi = () => window.electronAPI;

export const soundpadBridge = {
  isElectronAvailable() {
    return Boolean(getElectronApi()?.isElectron);
  },

  usesInAppSoundpad,

  async getAvailability() {
    if (!this.isElectronAvailable()) {
      return { available: true, platform: 'web', mode: 'inApp' };
    }
    return { available: true, platform: 'electron', mode: 'inApp' };
  },

  async getStatus() {
    return { running: soundpadInAppMixer.isActive(), mode: 'inApp' };
  },

  async playSlot(slotId) {
    soundpadLog('playSlot: start', { slotId });

    const config = soundpadStorage.getConfig();
    const slot = config.slots.find((item) => item.id === slotId);
    if (!slot?.soundId) {
      soundpadWarn('playSlot: slot missing or no soundId', { slotId, slot });
      throw new Error('Слот не настроен');
    }

    const blob = await soundpadStorage.getSoundBlob(slot.soundId);
    if (!blob) {
      soundpadWarn('playSlot: blob not found in IndexedDB', { soundId: slot.soundId });
      throw new Error('Файл звука не найден');
    }

    const volume = Math.max(0, Math.min(2, (slot.volume ?? 1) * (config.globalVolume ?? 1)));
    const monitorPlay = soundpadLocalMonitor.playBlob(blob, volume).catch((error) => {
      soundpadWarn('playSlot: local monitor failed', error);
    });

    soundpadLog('playSlot: loaded blob', {
      soundId: slot.soundId,
      label: slot.label,
      mimeType: blob.type,
      sizeBytes: blob.size,
      mode: 'inApp',
    });

    const result = await soundpadInAppMixer.playBlob(blob, volume);
    await monitorPlay;
    soundpadLog('playSlot: inApp done', result);
    return { ...result, mode: 'inApp' };
  },

  async stopPlayback() {
    soundpadLog('stopPlayback');
    soundpadLocalMonitor.stopPlayback();
    soundpadInAppMixer.stopPlayback();
  },

  setMonitorEnabled(enabled) {
    soundpadLocalMonitor.setEnabled(enabled);
  },

  setMonitorVolume(volume) {
    soundpadLocalMonitor.setVolume(volume);
  },

  getMonitorSettings() {
    const config = soundpadStorage.getConfig();
    return {
      enabled: config.monitorEnabled !== false,
      volume: config.monitorVolume ?? 1,
    };
  },

  async syncAudioConfigToElectron() {
    return { skipped: true };
  },

  async warmUpInAppMixer() {
    try {
      await soundpadInAppMixer.ensureInitialized({ audio: true });
      soundpadLog('warmUpInAppMixer: ready');
      return { ok: true };
    } catch (error) {
      soundpadWarn('warmUpInAppMixer failed', error);
      return { ok: false, error: error.message };
    }
  },
};
