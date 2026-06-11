import { soundpadLog, soundpadWarn } from './soundpadLogger';

/**
 * Mixes physical microphone with soundpad in the browser/Electron.
 * Mic mute only affects the voice branch — soundpad always reaches the output stream.
 */
class SoundpadInAppMixer {
  constructor() {
    this.audioContext = null;
    this.micStream = null;
    this.micSource = null;
    this.micGain = null;
    this.soundpadGain = null;
    this.voiceDestination = null;
    this.soundpadDestination = null;
    this.micMuted = false;
    this.activeSources = new Set();
  }

  isActive() {
    return Boolean(this.voiceDestination?.stream?.active);
  }

  async ensureInitialized(audioConstraints = { audio: true }) {
    if (this.isActive()) {
      return this.getMixedStream();
    }

    this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
      sampleRate: 48000,
      latencyHint: 'interactive',
    });

    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

    this.micStream = await navigator.mediaDevices.getUserMedia(audioConstraints);
    return this._wireGraph(this.micStream);
  }

  async attachMicStream(stream) {
    if (!stream?.getAudioTracks?.()?.length) {
      throw new Error('No audio tracks in mic stream');
    }

    if (!this.audioContext || this.audioContext.state === 'closed') {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: 48000,
        latencyHint: 'interactive',
      });
    }

    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

    this._disconnectMic();
    if (this.micStream && this.micStream !== stream) {
      this.micStream.getTracks().forEach((track) => {
        if (track.readyState !== 'ended') track.stop();
      });
    }

    this.micStream = stream;
    return this._wireGraph(stream);
  }

  _wireGraph(stream) {
    this._disconnectMic();

    this.micSource = this.audioContext.createMediaStreamSource(stream);
    this.micGain = this.audioContext.createGain();
    this.soundpadGain = this.audioContext.createGain();
    this.voiceDestination = this.audioContext.createMediaStreamDestination();
    this.soundpadDestination = this.audioContext.createMediaStreamDestination();

    this.micGain.gain.value = this.micMuted ? 0 : 1;
    this.micSource.connect(this.micGain);
    this.micGain.connect(this.voiceDestination);
    this.soundpadGain.connect(this.soundpadDestination);

    soundpadLog('soundpadInAppMixer: graph ready (voice + soundpad tracks)');
    return this.getVoiceStream();
  }

  _disconnectMic() {
    try {
      this.micSource?.disconnect();
    } catch {
      // ignore
    }
    try {
      this.micGain?.disconnect();
    } catch {
      // ignore
    }
  }

  getVoiceStream() {
    return this.voiceDestination?.stream ?? this.micStream;
  }

  getSoundpadStream() {
    return this.soundpadDestination?.stream ?? null;
  }

  /** @deprecated use getVoiceStream */
  getMixedStream() {
    return this.getVoiceStream();
  }

  getAudioContext() {
    return this.audioContext;
  }

  setMicMuted(muted) {
    this.micMuted = Boolean(muted);
    if (this.micGain) {
      this.micGain.gain.value = this.micMuted ? 0 : 1;
    }
    soundpadLog('soundpadInAppMixer: mic muted =', this.micMuted);
  }

  async playBlob(blob, volume = 1) {
    if (!this.isActive()) {
      await this.ensureInitialized({ audio: true });
    }

    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

    const arrayBuffer = await blob.arrayBuffer();
    let audioBuffer;
    try {
      audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer.slice(0));
    } catch (error) {
      soundpadWarn('soundpadInAppMixer: decodeAudioData failed', error);
      throw error;
    }

    const source = this.audioContext.createBufferSource();
    source.buffer = audioBuffer;
    const gain = this.audioContext.createGain();
    gain.gain.value = Math.max(0, Math.min(2, volume));
    source.connect(gain);
    gain.connect(this.soundpadGain);

    return new Promise((resolve, reject) => {
      this.activeSources.add(source);
      source.onended = () => {
        this.activeSources.delete(source);
        resolve({ ok: true });
      };
      try {
        source.start(0);
        soundpadLog('soundpadInAppMixer: playing', { duration: audioBuffer.duration, volume });
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

  dispose() {
    this.stopPlayback();
    this._disconnectMic();
    try {
      this.soundpadGain?.disconnect();
    } catch {
      // ignore
    }
    this.micStream?.getTracks().forEach((track) => {
      if (track.readyState !== 'ended') track.stop();
    });
    this.micStream = null;
    this.micSource = null;
    this.micGain = null;
    this.soundpadGain = null;
    this.voiceDestination = null;
    this.soundpadDestination = null;
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close().catch(() => {});
    }
    this.audioContext = null;
  }
}

export const soundpadInAppMixer = new SoundpadInAppMixer();

export function usesInAppSoundpad() {
  try {
    const raw = localStorage.getItem('whithinAudioDevices');
    if (!raw) return true;
    const config = JSON.parse(raw);
    return config.soundpadMode !== 'system';
  } catch {
    return true;
  }
}
