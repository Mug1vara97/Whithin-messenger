/**
 * Изолированная аудио-система для голосовых звонков
 * Использует отдельный AudioContext для воспроизведения звука участников,
 * который НЕ захватывается при демонстрации экрана
 */

class IsolatedCallAudioManager {
  constructor() {
    this.audioContext = null;
    this.participants = new Map(); // Map<userId, { source, gain, audioElement }>
    this.masterGainNode = null;
    this.isInitialized = false;
    this.destinationNode = null;
  }

  /**
   * Инициализация изолированной аудио-системы
   */
  async initialize() {
    if (this.isInitialized && this.audioContext && this.audioContext.state !== 'closed') {
      return;
    }

    try {
      // Создаем ОТДЕЛЬНЫЙ AudioContext для звонков
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: 48000,
        latencyHint: 'interactive'
      });

      // Создаем master gain node для управления общей громкостью
      this.masterGainNode = this.audioContext.createGain();
      this.masterGainNode.gain.value = 1.0;

      // Создаем промежуточный destination node
      this.destinationNode = this.audioContext.createMediaStreamDestination();
      
      // Подключаем master gain к destination
      this.masterGainNode.connect(this.destinationNode);

      // КРИТИЧНО: НЕ подключаем напрямую к audioContext.destination
      // Вместо этого создаем audio element с этим stream
      const audioElement = document.createElement('audio');
      audioElement.srcObject = this.destinationNode.stream;
      audioElement.autoplay = true;
      audioElement.playsInline = true;
      audioElement.controls = false;
      audioElement.style.display = 'none';
      
      // ВАЖНО: Устанавливаем специальный атрибут для идентификации
      audioElement.setAttribute('data-call-audio', 'true');
      audioElement.setAttribute('data-audio-type', 'call-participants');
      
      document.body.appendChild(audioElement);
      
      // Пытаемся воспроизвести (может потребоваться user interaction)
      try {
        await audioElement.play();
        console.log('✅ IsolatedCallAudio: Initialized successfully');
      } catch (error) {
        console.warn('⚠️ IsolatedCallAudio: Autoplay blocked, waiting for user interaction:', error);
      }

      this.isInitialized = true;
    } catch (error) {
      console.error('❌ IsolatedCallAudio: Failed to initialize:', error);
      throw error;
    }
  }

  /**
   * Возобновление аудио контекста (если был приостановлен)
   */
  async resume() {
    if (this.audioContext && this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
      console.log('🔊 IsolatedCallAudio: AudioContext resumed');
    }
  }

  /**
   * Добавление участника звонка
   * @param {string} userId - ID пользователя
   * @param {MediaStream} mediaStream - Аудио поток участника
   * @param {Object} options - Опции (volume, muted)
   */
  async addParticipant(userId, mediaStream, options = {}) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    await this.resume();

    // Удаляем существующего участника если есть
    this.removeParticipant(userId);

    try {
      // Создаем source из MediaStream
      const source = this.audioContext.createMediaStreamSource(mediaStream);
      
      // Создаем gain node для индивидуального контроля громкости
      const gainNode = this.audioContext.createGain();
      
      // Устанавливаем начальную громкость
      const volume = options.volume !== undefined ? options.volume : 1.0;
      const muted = options.muted || false;
      gainNode.gain.value = muted ? 0 : volume;

      // Подключаем: source -> gain -> masterGain
      source.connect(gainNode);
      gainNode.connect(this.masterGainNode);

      // Сохраняем участника
      this.participants.set(userId, {
        source,
        gain: gainNode,
        volume,
        muted
      });

      console.log(`✅ IsolatedCallAudio: Added participant ${userId}`);
    } catch (error) {
      console.error(`❌ IsolatedCallAudio: Failed to add participant ${userId}:`, error);
    }
  }

  /**
   * Удаление участника
   * @param {string} userId 
   */
  removeParticipant(userId) {
    const participant = this.participants.get(userId);
    if (!participant) return;

    try {
      // Отключаем все узлы
      participant.source.disconnect();
      participant.gain.disconnect();
      
      this.participants.delete(userId);
      console.log(`🗑️ IsolatedCallAudio: Removed participant ${userId}`);
    } catch (error) {
      console.warn(`⚠️ IsolatedCallAudio: Error removing participant ${userId}:`, error);
    }
  }

  /**
   * Изменение громкости участника
   * @param {string} userId 
   * @param {number} volume - Громкость (0-1)
   */
  setParticipantVolume(userId, volume) {
    const participant = this.participants.get(userId);
    if (!participant) {
      console.warn(`⚠️ IsolatedCallAudio: Participant ${userId} not found`);
      return;
    }

    participant.volume = volume;
    if (!participant.muted) {
      participant.gain.gain.value = volume;
    }
    console.log(`🔊 IsolatedCallAudio: Set volume for ${userId}: ${volume}`);
  }

  /**
   * Отключение/включение звука участника
   * @param {string} userId 
   * @param {boolean} muted 
   */
  setParticipantMuted(userId, muted) {
    const participant = this.participants.get(userId);
    if (!participant) {
      console.warn(`⚠️ IsolatedCallAudio: Participant ${userId} not found`);
      return;
    }

    participant.muted = muted;
    participant.gain.gain.value = muted ? 0 : participant.volume;
    console.log(`🔇 IsolatedCallAudio: Set muted for ${userId}: ${muted}`);
  }

  /**
   * Установка мастер-громкости (для всех участников)
   * @param {number} volume - Громкость (0-1)
   */
  setMasterVolume(volume) {
    if (!this.masterGainNode) return;
    
    this.masterGainNode.gain.value = volume;
    console.log(`🔊 IsolatedCallAudio: Set master volume: ${volume}`);
  }

  /**
   * Получение информации об участнике
   * @param {string} userId 
   */
  getParticipantInfo(userId) {
    const participant = this.participants.get(userId);
    if (!participant) return null;

    return {
      volume: participant.volume,
      muted: participant.muted
    };
  }

  /**
   * Полная очистка системы
   */
  cleanup() {
    console.log('🧹 IsolatedCallAudio: Cleaning up...');

    // Удаляем всех участников
    for (const userId of this.participants.keys()) {
      this.removeParticipant(userId);
    }

    // Удаляем audio element
    const audioElement = document.querySelector('audio[data-call-audio="true"]');
    if (audioElement && audioElement.parentNode) {
      audioElement.pause();
      audioElement.srcObject = null;
      audioElement.parentNode.removeChild(audioElement);
    }

    // Закрываем аудио контекст
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
    }

    this.audioContext = null;
    this.masterGainNode = null;
    this.destinationNode = null;
    this.participants.clear();
    this.isInitialized = false;

    console.log('✅ IsolatedCallAudio: Cleanup completed');
  }

  /**
   * Получение текущего состояния
   */
  getState() {
    return {
      isInitialized: this.isInitialized,
      contextState: this.audioContext?.state,
      participantsCount: this.participants.size,
      participants: Array.from(this.participants.keys())
    };
  }
}

// Создаем глобальный экземпляр
export const isolatedCallAudioManager = new IsolatedCallAudioManager();

// Экспортируем также класс
export { IsolatedCallAudioManager };

