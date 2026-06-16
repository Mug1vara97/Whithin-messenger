import { soundpadStorage } from './soundpadStorage';
import { soundpadLog, soundpadWarn } from './soundpadLogger';

const clampVolume = (value) => Math.max(0, Math.min(2, Number(value) || 0));

/**
 * Plays soundpad clips to local speakers/headphones (monitor), separate from the call mix.
 */
class SoundpadLocalMonitor {
  constructor() {
    this.audioContext = null;
    this.monitorGain = null;
    this.activeSources = new Set();
  }

  isEnabled() {
    return soundpadStorage.getConfig().monitorEnabled !== false;
  }

  getMonitorVolume() {
    return clampVolume(soundpadStorage.getConfig().monitorVolume ?? 1);
  }

  async ensureContext() {
    if (this.audioContext?.state === 'closed') {
      this.audioContext = null;
      this.monitorGain = null;
    }

    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: 48000,
        latencyHint: 'interactive',
      });
      this.monitorGain = this.audioContext.createGain();
      this.monitorGain.connect(this.audioContext.destination);
      this.syncGainFromStorage();
    }

    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
  }

  syncGainFromStorage() {
    if (!this.monitorGain) return;
    const enabled = this.isEnabled();
    this.monitorGain.gain.value = enabled ? this.getMonitorVolume() : 0;
  }

  setEnabled(enabled) {
    soundpadStorage.saveConfig({ monitorEnabled: Boolean(enabled) });
    this.syncGainFromStorage();
    soundpadLog('soundpadLocalMonitor: enabled =', Boolean(enabled));
  }

  setVolume(volume) {
    const next = clampVolume(volume);
    soundpadStorage.saveConfig({ monitorVolume: next });
    this.syncGainFromStorage();
    soundpadLog('soundpadLocalMonitor: volume =', next);
  }

  async playBlob(blob, streamVolume = 1) {
    if (!this.isEnabled()) {
      return { skipped: true, reason: 'monitor-disabled' };
    }

    await this.ensureContext();
    this.syncGainFromStorage();

    const arrayBuffer = await blob.arrayBuffer();
    let audioBuffer;
    try {
      audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer.slice(0));
    } catch (error) {
      soundpadWarn('soundpadLocalMonitor: decodeAudioData failed', error);
      throw error;
    }

    const source = this.audioContext.createBufferSource();
    source.buffer = audioBuffer;
    const gain = this.audioContext.createGain();
    gain.gain.value = clampVolume(streamVolume);
    source.connect(gain);
    gain.connect(this.monitorGain);

    return new Promise((resolve, reject) => {
      this.activeSources.add(source);
      source.onended = () => {
        this.activeSources.delete(source);
        resolve({ ok: true });
      };
      try {
        source.start(0);
        soundpadLog('soundpadLocalMonitor: playing locally', {
          duration: audioBuffer.duration,
          streamVolume: gain.gain.value,
          monitorVolume: this.monitorGain.gain.value,
        });
      } catch (error) {
        this.activeSources.delete(source);
        reject(error);
      }
    });
  }

  stopPlayback() {
    this.activeSources.forEach((source) => {
      try {
        source.stop();
      } catch {
        // ignore
      }
    });
    this.activeSources.clear();
  }
}

export const soundpadLocalMonitor = new SoundpadLocalMonitor();
