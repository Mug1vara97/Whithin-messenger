/**
 * Voice Activity Detector (VAD)
 * Детектор голосовой активности для определения, когда пользователь говорит
 * Использует Web Audio API для анализа аудио потока
 */

export class VoiceActivityDetector {
  constructor(options = {}) {
    this.audioContext = options.audioContext || null;
    this.analyser = null;
    this.source = null;
    this.dataArray = null;
    this.animationFrame = null;
    this.isRunning = false;
    
    // Настройки детекции
    this.threshold = options.threshold || 15; // Порог громкости для определения говорения (0-255)
    this.smoothingFactor = options.smoothingFactor || 0.3; // Сглаживание для предотвращения "дрожания"
    this.holdTime = options.holdTime || 200; // Время удержания состояния "говорит" (мс)
    
    // Состояние
    this.isSpeaking = false;
    this.lastSpeakingTime = 0;
    this.smoothedVolume = 0;
    
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
      // Создаём или используем существующий AudioContext
      if (audioContext) {
        this.audioContext = audioContext;
      } else if (!this.audioContext || this.audioContext.state === 'closed') {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
          sampleRate: 48000,
          latencyHint: 'interactive'
        });
      }
      
      // Возобновляем AudioContext если он приостановлен
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }
      
      // Создаём AnalyserNode для анализа частот
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.8;
      
      // Создаём источник из потока
      this.source = this.audioContext.createMediaStreamSource(stream);
      this.source.connect(this.analyser);
      
      // Массив для данных анализа
      this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
      
      this.isRunning = true;
      this.analyze();
      
      console.log('[VAD] Started voice activity detection');
    } catch (error) {
      console.error('[VAD] Failed to start:', error);
    }
  }
  
  /**
   * Анализ аудио данных в цикле
   */
  analyze() {
    if (!this.isRunning || !this.analyser) return;
    
    this.analyser.getByteFrequencyData(this.dataArray);
    
    // Вычисляем среднюю громкость
    let sum = 0;
    for (let i = 0; i < this.dataArray.length; i++) {
      sum += this.dataArray[i];
    }
    const averageVolume = sum / this.dataArray.length;
    
    // Сглаживание громкости
    this.smoothedVolume = this.smoothedVolume * (1 - this.smoothingFactor) + averageVolume * this.smoothingFactor;
    
    // Определяем, говорит ли пользователь
    const now = Date.now();
    const wasSpeaking = this.isSpeaking;
    
    if (this.smoothedVolume > this.threshold) {
      this.isSpeaking = true;
      this.lastSpeakingTime = now;
    } else if (now - this.lastSpeakingTime > this.holdTime) {
      this.isSpeaking = false;
    }
    
    // Вызываем коллбэк при изменении состояния
    if (wasSpeaking !== this.isSpeaking) {
      this.onSpeakingChange(this.isSpeaking);
    }
    
    // Вызываем коллбэк громкости (опционально)
    this.onVolumeChange(this.smoothedVolume);
    
    // Продолжаем анализ
    this.animationFrame = requestAnimationFrame(() => this.analyze());
  }
  
  /**
   * Остановка детектора
   */
  stop() {
    this.isRunning = false;
    
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
    
    if (this.source) {
      try {
        this.source.disconnect();
      } catch (e) {
        // Игнорируем ошибки отключения
      }
      this.source = null;
    }
    
    this.analyser = null;
    this.dataArray = null;
    this.isSpeaking = false;
    this.smoothedVolume = 0;
    
    console.log('[VAD] Stopped voice activity detection');
  }
  
  /**
   * Установка порога громкости
   * @param {number} threshold - Порог (0-255)
   */
  setThreshold(threshold) {
    this.threshold = Math.max(0, Math.min(255, threshold));
  }
  
  /**
   * Получение текущего состояния
   * @returns {boolean}
   */
  getSpeakingState() {
    return this.isSpeaking;
  }
  
  /**
   * Получение текущей громкости (0-255)
   * @returns {number}
   */
  getVolume() {
    return this.smoothedVolume;
  }
  
  /**
   * Очистка ресурсов
   */
  cleanup() {
    this.stop();
    // Не закрываем audioContext, так как он может использоваться другими компонентами
    this.audioContext = null;
  }
}

/**
 * Менеджер VAD для нескольких участников
 */
export class VoiceActivityManager {
  constructor() {
    this.detectors = new Map(); // userId -> VoiceActivityDetector
    this.speakingStates = new Map(); // userId -> boolean
    this.onSpeakingStatesChange = null;
  }
  
  /**
   * Добавление детектора для участника
   * @param {string} userId - ID пользователя
   * @param {MediaStream} stream - Аудио поток
   * @param {AudioContext} audioContext - Общий аудио контекст
   */
  async addParticipant(userId, stream, audioContext) {
    // Удаляем существующий детектор если есть
    this.removeParticipant(userId);
    
    const detector = new VoiceActivityDetector({
      audioContext,
      threshold: 12, // Немного ниже порог для удаленных участников
      holdTime: 250,
      onSpeakingChange: (isSpeaking) => {
        this.speakingStates.set(userId, isSpeaking);
        this.notifyChange();
      }
    });
    
    await detector.start(stream, audioContext);
    this.detectors.set(userId, detector);
    this.speakingStates.set(userId, false);
    
    console.log('[VADManager] Added participant:', userId);
  }
  
  /**
   * Удаление детектора участника
   * @param {string} userId - ID пользователя
   */
  removeParticipant(userId) {
    const detector = this.detectors.get(userId);
    if (detector) {
      detector.cleanup();
      this.detectors.delete(userId);
      this.speakingStates.delete(userId);
      console.log('[VADManager] Removed participant:', userId);
    }
  }
  
  /**
   * Получение состояния говорения участника
   * @param {string} userId - ID пользователя
   * @returns {boolean}
   */
  isSpeaking(userId) {
    return this.speakingStates.get(userId) || false;
  }
  
  /**
   * Получение всех состояний говорения
   * @returns {Map<string, boolean>}
   */
  getAllSpeakingStates() {
    return new Map(this.speakingStates);
  }
  
  /**
   * Установка коллбэка на изменение состояний
   * @param {Function} callback
   */
  setOnSpeakingStatesChange(callback) {
    this.onSpeakingStatesChange = callback;
  }
  
  /**
   * Уведомление об изменении состояний
   */
  notifyChange() {
    if (this.onSpeakingStatesChange) {
      this.onSpeakingStatesChange(new Map(this.speakingStates));
    }
  }
  
  /**
   * Очистка всех детекторов
   */
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
