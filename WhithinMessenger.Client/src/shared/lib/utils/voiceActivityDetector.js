/**
 * Voice Activity Detector (VAD)
 * Детектор голосовой активности для определения, когда пользователь говорит
 * Использует Web Audio API для анализа аудио потока
 */

import {
  createSpeechBandAnalyserChain,
  measureSpeechBandLevel,
} from './voiceLevelAnalysis';

/** Shared tuning for call transmission + mic test preview. */
export const VOICE_ACTIVATION_VAD_OPTIONS = {
  holdTime: 220,
  activationDebounceTime: 35,
  deactivationDebounceTime: 100,
  minActivationFrames: 2,
  smoothingFactor: 0.5,
};

export class VoiceActivityDetector {
  constructor(options = {}) {
    this.audioContext = options.audioContext || null;
    this.analyser = null;
    this.source = null;
    this.speechHighPass = null;
    this.speechLowPass = null;
    this.scriptProcessor = null;
    this.silentGain = null;
    this.dataArray = null;
    this.isRunning = false;

    // Настройки детекции
    this.threshold = options.threshold || 30;
    this.smoothingFactor = options.smoothingFactor ?? VOICE_ACTIVATION_VAD_OPTIONS.smoothingFactor;
    this.holdTime = options.holdTime ?? VOICE_ACTIVATION_VAD_OPTIONS.holdTime;
    this.activationDebounceTime =
      options.activationDebounceTime ?? VOICE_ACTIVATION_VAD_OPTIONS.activationDebounceTime;
    this.deactivationDebounceTime =
      options.deactivationDebounceTime ?? VOICE_ACTIVATION_VAD_OPTIONS.deactivationDebounceTime;
    // Legacy single debounce value — applies to both directions if new options omitted.
    if (options.debounceTime != null) {
      this.activationDebounceTime = options.debounceTime;
      this.deactivationDebounceTime = options.debounceTime;
    }
    this.minActivationFrames =
      options.minActivationFrames ?? VOICE_ACTIVATION_VAD_OPTIONS.minActivationFrames;

    // Состояние
    this.isSpeaking = false;
    this.lastSpeakingTime = 0;
    this.lastStateChangeTime = 0;
    this.smoothedVolume = 0;
    this.framesAboveThreshold = 0;

    // Коллбэки
    this.onSpeakingChange = options.onSpeakingChange || (() => {});
    this.onVolumeChange = options.onVolumeChange || (() => {});
  }

  /**
   * Инициализация детектора с аудио потоком
   * @param {MediaStream} stream - Аудио поток для анализа
   * @param {AudioContext} audioContext - Аудио контекст (опционально)
   */
  async start(stream, audioContext = null) {
    if (this.isRunning) {
      this.stop();
    }

    try {
      if (audioContext) {
        this.audioContext = audioContext;
      } else if (!this.audioContext || this.audioContext.state === 'closed') {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
          sampleRate: 48000,
          latencyHint: 'interactive',
        });
      }

      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      this.source = this.audioContext.createMediaStreamSource(stream);
      const chain = createSpeechBandAnalyserChain(this.audioContext, this.source);
      this.speechHighPass = chain.highPass;
      this.speechLowPass = chain.lowPass;
      this.analyser = chain.analyser;
      this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);

      // Анализ на аудио-потоке: не зависит от requestAnimationFrame (свёрнутое окно).
      this.silentGain = this.audioContext.createGain();
      this.silentGain.gain.value = 0;
      this.scriptProcessor = this.audioContext.createScriptProcessor(1024, 1, 1);
      this.scriptProcessor.onaudioprocess = () => {
        if (!this.isRunning || !this.analyser) return;
        this.processFrame();
      };

      this.analyser.connect(this.scriptProcessor);
      this.scriptProcessor.connect(this.silentGain);
      this.silentGain.connect(this.audioContext.destination);

      this.isRunning = true;

      console.log('[VAD] Started voice activity detection');
    } catch (error) {
      console.error('[VAD] Failed to start:', error);
    }
  }

  processFrame() {
    if (!this.isRunning || !this.analyser || !this.dataArray) return;

    if (this.audioContext?.state === 'suspended') {
      void this.audioContext.resume();
    }

    this.analyser.getByteFrequencyData(this.dataArray);

    const averageVolume = measureSpeechBandLevel(
      this.dataArray,
      this.analyser.fftSize,
      this.audioContext.sampleRate,
    );

    this.smoothedVolume =
      this.smoothedVolume * (1 - this.smoothingFactor) + averageVolume * this.smoothingFactor;

    const now = Date.now();
    const wasSpeaking = this.isSpeaking;
    let newSpeakingState = this.isSpeaking;

    if (this.smoothedVolume > this.threshold) {
      this.framesAboveThreshold += 1;
      if (this.framesAboveThreshold >= this.minActivationFrames) {
        newSpeakingState = true;
        this.lastSpeakingTime = now;
      }
    } else {
      this.framesAboveThreshold = 0;
      if (now - this.lastSpeakingTime > this.holdTime) {
        newSpeakingState = false;
      }
    }

    const timeSinceLastChange = now - this.lastStateChangeTime;
    const debounceTime = newSpeakingState
      ? this.activationDebounceTime
      : this.deactivationDebounceTime;

    if (wasSpeaking !== newSpeakingState && timeSinceLastChange >= debounceTime) {
      this.isSpeaking = newSpeakingState;
      this.lastStateChangeTime = now;
      this.onSpeakingChange(this.isSpeaking);
    }

    this.onVolumeChange(this.smoothedVolume);
  }

  stop() {
    this.isRunning = false;

    if (this.scriptProcessor) {
      this.scriptProcessor.onaudioprocess = null;
      try {
        this.scriptProcessor.disconnect();
      } catch (_) {
        /* ignore */
      }
      this.scriptProcessor = null;
    }

    if (this.silentGain) {
      try {
        this.silentGain.disconnect();
      } catch (_) {
        /* ignore */
      }
      this.silentGain = null;
    }

    if (this.analyser) {
      try {
        this.analyser.disconnect();
      } catch (_) {
        /* ignore */
      }
    }

    if (this.speechLowPass) {
      try {
        this.speechLowPass.disconnect();
      } catch (_) {
        /* ignore */
      }
      this.speechLowPass = null;
    }

    if (this.speechHighPass) {
      try {
        this.speechHighPass.disconnect();
      } catch (_) {
        /* ignore */
      }
      this.speechHighPass = null;
    }

    if (this.source) {
      try {
        this.source.disconnect();
      } catch (_) {
        /* ignore */
      }
      this.source = null;
    }

    if (this.isSpeaking) {
      this.isSpeaking = false;
      this.onSpeakingChange(false);
    }

    this.analyser = null;
    this.dataArray = null;
    this.smoothedVolume = 0;
    this.framesAboveThreshold = 0;
    this.lastSpeakingTime = 0;
    this.lastStateChangeTime = 0;

    console.log('[VAD] Stopped voice activity detection');
  }

  forceReset() {
    if (this.isSpeaking) {
      this.isSpeaking = false;
      this.lastSpeakingTime = 0;
      this.lastStateChangeTime = Date.now();
      this.framesAboveThreshold = 0;
      this.onSpeakingChange(false);
      console.log('[VAD] Force reset speaking state');
    }
  }

  setThreshold(threshold) {
    this.threshold = Math.max(0, Math.min(255, threshold));
  }

  getSpeakingState() {
    return this.isSpeaking;
  }

  getVolume() {
    return this.smoothedVolume;
  }

  cleanup() {
    this.stop();
    this.audioContext = null;
  }
}

/**
 * Менеджер VAD для нескольких участников
 */
export class VoiceActivityManager {
  constructor() {
    this.detectors = new Map();
    this.speakingStates = new Map();
    this.onSpeakingStatesChange = null;
  }

  async addParticipant(userId, stream, audioContext) {
    this.removeParticipant(userId);

    const detector = new VoiceActivityDetector({
      audioContext,
      threshold: 12,
      holdTime: 250,
      onSpeakingChange: (isSpeaking) => {
        this.speakingStates.set(userId, isSpeaking);
        this.notifyChange();
      },
    });

    await detector.start(stream, audioContext);
    this.detectors.set(userId, detector);
    this.speakingStates.set(userId, false);

    console.log('[VADManager] Added participant:', userId);
  }

  removeParticipant(userId) {
    const detector = this.detectors.get(userId);
    if (detector) {
      detector.cleanup();
      this.detectors.delete(userId);
      this.speakingStates.delete(userId);
      console.log('[VADManager] Removed participant:', userId);
    }
  }

  isSpeaking(userId) {
    return this.speakingStates.get(userId) || false;
  }

  getAllSpeakingStates() {
    return new Map(this.speakingStates);
  }

  setOnSpeakingStatesChange(callback) {
    this.onSpeakingStatesChange = callback;
  }

  notifyChange() {
    if (this.onSpeakingStatesChange) {
      this.onSpeakingStatesChange(new Map(this.speakingStates));
    }
  }

  cleanup() {
    for (const detector of this.detectors.values()) {
      detector.cleanup();
    }
    this.detectors.clear();
    this.speakingStates.clear();
    console.log('[VADManager] Cleaned up all detectors');
  }
}

export default VoiceActivityDetector;
