/**
 * Утилита для воспроизведения звуков уведомлений в голосовых звонках
 */

import { getAppSoundUrl } from './appSoundSettings';

const VOICE_SOUND_IDS = [
  'userJoined',
  'userLeft',
  'micMuted',
  'micUnmuted',
  'globalMuted',
  'globalUnmuted',
];

class AudioNotificationManager {
  constructor() {
    this.audioContext = null;
    this.sounds = {
      userJoined: null,
      userLeft: null,
      micMuted: null,
      micUnmuted: null,
      globalMuted: null,
      globalUnmuted: null,
    };
    this.isInitialized = false;
    this._lastJoinSoundAtByKey = new Map();
    this._joinSoundPending = new Set();
  }

  async initialize() {
    if (this.isInitialized) return;

    try {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: 48000,
        latencyHint: 'interactive',
      });

      await this.loadSounds();

      this.isInitialized = true;
      console.log('AudioNotificationManager: Initialized successfully');
    } catch (error) {
      console.error('AudioNotificationManager: Failed to initialize:', error);
    }
  }

  async decodeSound(soundId) {
    const url = getAppSoundUrl(soundId);
    if (!url || !this.audioContext) {
      return null;
    }

    try {
      const response = await fetch(url);
      if (!response.ok) {
        return null;
      }
      const arrayBuffer = await response.arrayBuffer();
      return await this.audioContext.decodeAudioData(arrayBuffer);
    } catch (error) {
      console.warn(`AudioNotificationManager: Failed to load ${soundId}:`, error);
      return null;
    }
  }

  async loadSounds() {
    if (!this.audioContext) {
      return;
    }

    await Promise.all(
      VOICE_SOUND_IDS.map(async (soundId) => {
        this.sounds[soundId] = await this.decodeSound(soundId);
      }),
    );
  }

  async reloadSounds() {
    if (!this.audioContext || this.audioContext.state === 'closed') {
      this.isInitialized = false;
      await this.initialize();
      return;
    }

    VOICE_SOUND_IDS.forEach((soundId) => {
      this.sounds[soundId] = null;
    });
    await this.loadSounds();
  }

  async playUserJoinedSound(options = {}) {
    const dedupeKey = options.dedupeKey ?? 'default';
    if (this._joinSoundPending.has(dedupeKey)) {
      return;
    }

    const now = Date.now();
    const lastPlayedAt = this._lastJoinSoundAtByKey.get(dedupeKey) ?? 0;
    if (now - lastPlayedAt < 5000) {
      return;
    }

    this._joinSoundPending.add(dedupeKey);
    this._lastJoinSoundAtByKey.set(dedupeKey, now);

    try {
      await this.playSound('userJoined', 0.5);
    } finally {
      this._joinSoundPending.delete(dedupeKey);
    }
  }

  async playUserLeftSound() {
    await this.playSound('userLeft', 0.5);
  }

  async playMicMutedSound() {
    await this.playSound('micMuted', 0.5);
  }

  async playMicUnmutedSound() {
    await this.playSound('micUnmuted', 0.5);
  }

  async playGlobalMutedSound() {
    await this.playSound('globalMuted', 0.6);
  }

  async playGlobalUnmutedSound() {
    await this.playSound('globalUnmuted', 0.6);
  }

  async playSound(soundName, volume = 0.5) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!this.audioContext || this.audioContext.state === 'closed') {
      console.warn('AudioNotificationManager: AudioContext not available');
      return;
    }

    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

    let sound = this.sounds[soundName];
    if (!sound) {
      this.sounds[soundName] = await this.decodeSound(soundName);
      sound = this.sounds[soundName];
    }
    if (!sound) {
      console.warn(`AudioNotificationManager: Sound ${soundName} not loaded`);
      return;
    }

    try {
      const source = this.audioContext.createBufferSource();
      const gainNode = this.audioContext.createGain();

      source.buffer = sound;
      gainNode.gain.value = volume;

      source.connect(gainNode);
      gainNode.connect(this.audioContext.destination);

      source.start(0);
    } catch (error) {
      console.error(`AudioNotificationManager: Failed to play ${soundName} sound:`, error);
    }
  }

  cleanup() {
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
    }
    this.audioContext = null;
    this.sounds = {
      userJoined: null,
      userLeft: null,
      micMuted: null,
      micUnmuted: null,
      globalMuted: null,
      globalUnmuted: null,
    };
    this.isInitialized = false;
    this._lastJoinSoundAtByKey.clear();
    this._joinSoundPending.clear();
  }
}

export const audioNotificationManager = new AudioNotificationManager();

export { AudioNotificationManager };

if (typeof window !== 'undefined') {
  window.addEventListener('appSoundSettingsChanged', () => {
    audioNotificationManager.reloadSounds().catch(() => {});
  });
}
