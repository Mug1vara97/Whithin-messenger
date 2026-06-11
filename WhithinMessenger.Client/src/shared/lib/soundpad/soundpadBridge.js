import { audioDeviceStorage } from './audioDeviceStorage';
import { soundpadStorage } from './soundpadStorage';
import { soundpadInAppMixer, usesInAppSoundpad } from './soundpadInAppMixer';
import { shouldUseHybridSystemCallAudio } from './soundpadCallAudio';
import { soundpadLog, soundpadWarn, soundpadError } from './soundpadLogger';

const getElectronApi = () => window.electronAPI;

const extensionFromMime = (mimeType = '') => {
  if (mimeType.includes('wav')) return '.wav';
  if (mimeType.includes('ogg')) return '.ogg';
  if (mimeType.includes('webm')) return '.webm';
  return '.mp3';
};

let systemBridgeStartInFlight = null;

const blobToBase64 = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('Failed to read sound file'));
        return;
      }
      resolve(result.split(',')[1] || '');
    };
    reader.onerror = () => reject(reader.error || new Error('Failed to read sound file'));
    reader.readAsDataURL(blob);
  });

export const soundpadBridge = {
  isElectronAvailable() {
    const available = Boolean(getElectronApi()?.soundpadIsAvailable);
    soundpadLog('isElectronAvailable:', available);
    return available;
  },

  usesInAppSoundpad,

  async getAvailability() {
    if (!this.isElectronAvailable()) {
      soundpadWarn('getAvailability: not in Electron');
      return { available: true, platform: 'web', mode: usesInAppSoundpad() ? 'inApp' : 'system' };
    }
    const result = await getElectronApi().soundpadIsAvailable();
    soundpadLog('getAvailability:', result);
    return { ...result, mode: usesInAppSoundpad() ? 'inApp' : 'system' };
  },

  async listDevices() {
    if (!this.isElectronAvailable()) {
      return { inputs: [], outputs: [] };
    }
    const devices = await getElectronApi().soundpadListDevices();
    soundpadLog('listDevices:', {
      inputs: devices?.inputs?.length ?? 0,
      outputs: devices?.outputs?.length ?? 0,
      cables: this.findCableDevices(devices),
    });
    return devices;
  },

  async getStatus() {
    if (usesInAppSoundpad()) {
      return { running: soundpadInAppMixer.isActive(), mode: 'inApp' };
    }
    if (!this.isElectronAvailable()) {
      return { running: false, mode: 'system' };
    }
    const status = await getElectronApi().soundpadGetStatus();
    soundpadLog('getStatus:', status);
    return { ...status, mode: 'system' };
  },

  async startBridge() {
    const config = audioDeviceStorage.getConfig();
    soundpadLog('startBridge: config', {
      captureDeviceId: config.captureDeviceId || '(default)',
      renderDeviceId: config.renderDeviceId || '(auto CABLE Input)',
    });

    if (!getElectronApi()?.soundpadStartBridge) {
      throw new Error('VB-Cable мост доступен только в десктоп-приложении Whithin (Electron).');
    }

    const result = await getElectronApi().soundpadStartBridge({
      captureDeviceId: config.captureDeviceId || null,
      renderDeviceId: config.renderDeviceId || null,
    });
    soundpadLog('startBridge: IPC result', result);

    audioDeviceStorage.saveConfig({ bridgeEnabled: true, soundpadMode: 'system' });
    const status = await this.getStatus();
    soundpadLog('startBridge: status after start', status);
    return status;
  },

  async ensureSystemBridgeStarted() {
    if (usesInAppSoundpad()) {
      return { skipped: true, reason: 'inApp-mode' };
    }

    if (!this.isElectronAvailable()) {
      return { skipped: true, reason: 'not-electron' };
    }

    const status = await this.getStatus();
    if (status?.running) {
      if (/cable\s*output/i.test(String(status.captureDevice || ''))) {
        soundpadWarn('ensureSystemBridgeStarted: bridge captures CABLE Output — restarting');
        await this.stopBridge();
      } else {
        soundpadLog('ensureSystemBridgeStarted: already running');
        return status;
      }
    }

    if (systemBridgeStartInFlight) {
      return systemBridgeStartInFlight;
    }

    systemBridgeStartInFlight = (async () => {
      try {
        soundpadLog('ensureSystemBridgeStarted: auto-starting bridge');
        return await this.startBridge();
      } finally {
        systemBridgeStartInFlight = null;
      }
    })();

    return systemBridgeStartInFlight;
  },

  async stopBridge() {
    soundpadLog('stopBridge');
    if (!getElectronApi()?.soundpadStopBridge) return { ok: true };
    const result = await getElectronApi().soundpadStopBridge();
    soundpadLog('stopBridge: result', result);
    audioDeviceStorage.saveConfig({ bridgeEnabled: false });
    return { ok: true };
  },

  async playSlot(slotId) {
    soundpadLog('playSlot: start', { slotId });

    const config = soundpadStorage.getConfig();
    const slot = config.slots.find((item) => item.id === slotId);
    if (!slot?.soundId) {
      soundpadError('playSlot: slot missing or no soundId', { slotId, slot });
      throw new Error('Слот не настроен');
    }

    const blob = await soundpadStorage.getSoundBlob(slot.soundId);
    if (!blob) {
      soundpadError('playSlot: blob not found in IndexedDB', { soundId: slot.soundId });
      throw new Error('Файл звука не найден');
    }

    const volume = Math.max(0, Math.min(2, (slot.volume ?? 1) * (config.globalVolume ?? 1)));

    soundpadLog('playSlot: loaded blob', {
      soundId: slot.soundId,
      label: slot.label,
      mimeType: blob.type,
      sizeBytes: blob.size,
      mode: usesInAppSoundpad() ? 'inApp' : 'system',
    });

    if (usesInAppSoundpad()) {
      const result = await soundpadInAppMixer.playBlob(blob, volume);
      soundpadLog('playSlot: inApp done', result);
      return { ...result, mode: 'inApp' };
    }

    let status = await this.getStatus();
    if (!status?.running) {
      soundpadLog('playSlot: bridge not running — auto-starting');
      status = await this.ensureSystemBridgeStarted();
      if (!status?.running) {
        soundpadWarn('playSlot: bridge failed to auto-start');
        throw new Error('Не удалось запустить аудио-мост (VB-Cable). Проверьте настройки саундпада.');
      }
    }

    if (!getElectronApi()?.soundpadPlayBase64) {
      throw new Error('Воспроизведение через VB-Cable доступно только в десктоп-приложении.');
    }

    if (shouldUseHybridSystemCallAudio() && soundpadInAppMixer.isActive()) {
      try {
        await soundpadInAppMixer.playBlob(blob, volume);
        soundpadLog('playSlot: hybrid call mixer (NS on voice, soundpad clean)');
      } catch (error) {
        soundpadWarn('playSlot: hybrid mixer play failed', error);
      }
    }

    const base64 = await blobToBase64(blob);
    const extension = extensionFromMime(blob.type);

    const result = await getElectronApi().soundpadPlayBase64({
      base64,
      extension,
      volume,
      slotId,
      label: slot.label,
    });

    soundpadLog('playSlot: system bridge done', result);
    return { ...result, mode: 'system' };
  },

  async stopPlayback() {
    soundpadLog('stopPlayback');
    if (usesInAppSoundpad()) {
      soundpadInAppMixer.stopPlayback();
      return;
    }
    if (!getElectronApi()?.soundpadStopPlayback) return;
    await getElectronApi().soundpadStopPlayback();
  },

  buildElectronAudioConfig() {
    const config = audioDeviceStorage.getConfig();
    return {
      soundpadMode: config.soundpadMode || 'inApp',
      autoDefaultCableMic: config.autoDefaultCableMic !== false,
      cableOutputDeviceId: config.cableOutputDeviceId || null,
      cableInputDeviceId: config.cableInputDeviceId || null,
      captureDeviceId: config.captureDeviceId || null,
      renderDeviceId: config.renderDeviceId || null,
    };
  },

  async getCallAudioOutputStatus() {
    if (!getElectronApi()?.soundpadGetDefaultRenderStatus) {
      return null;
    }
    return getElectronApi().soundpadGetDefaultRenderStatus();
  },

  async findBrowserOutputDevice(deviceName) {
    if (!deviceName) {
      return null;
    }

    const devices = await navigator.mediaDevices.enumerateDevices();
    const target = deviceName.toLowerCase();
    const outputs = devices.filter(
      (device) =>
        device.kind === 'audiooutput' &&
        device.deviceId &&
        device.deviceId !== 'default' &&
        !/cable/i.test(device.label || ''),
    );

    const exact = outputs.find((device) => (device.label || '').toLowerCase() === target);
    if (exact) {
      return exact;
    }

    const partial = outputs.find((device) => {
      const label = (device.label || '').toLowerCase();
      return label.includes(target) || target.includes(label);
    });
    if (partial) {
      return partial;
    }

    const token = target.split(/[()[\]]/).map((part) => part.trim()).find((part) => part.length > 4);
    if (!token) {
      return outputs[0] || null;
    }

    return outputs.find((device) => (device.label || '').toLowerCase().includes(token)) || outputs[0] || null;
  },

  async routeCallAudioElements(audioElements) {
    if (usesInAppSoundpad() || typeof HTMLMediaElement.prototype.setSinkId !== 'function') {
      return { skipped: true };
    }

    const status = await this.getCallAudioOutputStatus();
    if (!status?.active) {
      return { skipped: true, reason: 'render-routing-inactive' };
    }
    const output = await this.findBrowserOutputDevice(status?.callAudioOutputDeviceName);
    if (!output) {
      soundpadWarn('routeCallAudioElements: physical output not found', status);
      return { ok: false };
    }

    const elements = audioElements instanceof Map ? Array.from(audioElements.values()) : audioElements;
    await Promise.all(
      elements.map((element) =>
        element.setSinkId(output.deviceId).catch((error) => {
          soundpadWarn('routeCallAudioElements: setSinkId failed', error);
        }),
      ),
    );

    soundpadLog('routeCallAudioElements: routed to', output.label);
    return { ok: true, deviceId: output.deviceId, label: output.label };
  },

  async syncAudioConfigToElectron() {
    if (!this.isElectronAvailable() || !getElectronApi()?.soundpadSyncAudioConfig) {
      return { skipped: true };
    }
    const payload = this.buildElectronAudioConfig();
    const result = await getElectronApi().soundpadSyncAudioConfig(payload);
    soundpadLog('syncAudioConfigToElectron:', payload, result);

    if (payload.soundpadMode === 'system') {
      await this.ensureSystemBridgeStarted().catch((error) => {
        soundpadWarn('ensureSystemBridgeStarted after sync failed', error);
      });
    }

    return result;
  },

  async warmUpSystemBridge() {
    if (usesInAppSoundpad()) return { skipped: true };
    try {
      const result = await this.ensureSystemBridgeStarted();
      soundpadLog('warmUpSystemBridge:', result);
      return { ok: true, ...result };
    } catch (error) {
      soundpadWarn('warmUpSystemBridge failed', error);
      return { ok: false, error: error.message };
    }
  },

  /** @deprecated use syncAudioConfigToElectron */
  async syncAutoDefaultCableMic() {
    return this.syncAudioConfigToElectron();
  },

  async setAutoDefaultCableMic(enabled) {
    audioDeviceStorage.saveConfig({ autoDefaultCableMic: Boolean(enabled) });
    if (!getElectronApi()?.soundpadSetAutoDefaultMic) return { skipped: true };
    const result = await getElectronApi().soundpadSetAutoDefaultMic(Boolean(enabled));
    soundpadLog('setAutoDefaultCableMic:', { enabled, result });
    return result;
  },

  async warmUpInAppMixer() {
    if (!usesInAppSoundpad()) return { skipped: true };
    try {
      await soundpadInAppMixer.ensureInitialized({ audio: true });
      soundpadLog('warmUpInAppMixer: ready');
      return { ok: true };
    } catch (error) {
      soundpadWarn('warmUpInAppMixer failed', error);
      return { ok: false, error: error.message };
    }
  },

  findCableDevices(devices) {
    const inputs = devices?.inputs || [];
    const outputs = devices?.outputs || [];
    return {
      cableInput: outputs.find((d) => /cable input/i.test(d.name)) || null,
      cableOutput: inputs.find((d) => /cable output/i.test(d.name)) || null,
    };
  },
};
