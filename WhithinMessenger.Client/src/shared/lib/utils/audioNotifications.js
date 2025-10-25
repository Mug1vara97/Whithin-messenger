/**
 * Утилита для воспроизведения звуков уведомлений в голосовых звонках
 */

class AudioNotificationManager {
  constructor() {
    this.audioContext = null;
    this.sounds = {
      userJoined: null,
      userLeft: null,
      micMuted: null,
      micUnmuted: null,
      globalMuted: null,
      globalUnmuted: null
    };
    this.isInitialized = false;
  }

  /**
   * Инициализация аудио контекста и загрузка звуков
   */
  async initialize() {
    if (this.isInitialized) return;

    try {
      // Создаем AudioContext
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: 48000,
        latencyHint: 'interactive'
      });

      // Загружаем звуки
      await this.loadSounds();
      
      this.isInitialized = true;
      console.log('AudioNotificationManager: Initialized successfully');
    } catch (error) {
      console.error('AudioNotificationManager: Failed to initialize:', error);
    }
  }

  /**
   * Загрузка звуковых файлов
   */
  async loadSounds() {
    try {
      // Загружаем звук подключения пользователя
      const userJoinedResponse = await fetch('/user-joined.mp3');
      if (userJoinedResponse.ok) {
        const userJoinedArrayBuffer = await userJoinedResponse.arrayBuffer();
        this.sounds.userJoined = await this.audioContext.decodeAudioData(userJoinedArrayBuffer);
      }

      // Загружаем звук отключения пользователя
      const userLeftResponse = await fetch('/user-left.mp3');
      if (userLeftResponse.ok) {
        const userLeftArrayBuffer = await userLeftResponse.arrayBuffer();
        this.sounds.userLeft = await this.audioContext.decodeAudioData(userLeftArrayBuffer);
      }

      // Загружаем звук мьюта микрофона
      const micMutedResponse = await fetch('/mic-muted.mp3');
      if (micMutedResponse.ok) {
        const micMutedArrayBuffer = await micMutedResponse.arrayBuffer();
        this.sounds.micMuted = await this.audioContext.decodeAudioData(micMutedArrayBuffer);
      }

      // Загружаем звук размьюта микрофона
      const micUnmutedResponse = await fetch('/mic-unmuted.mp3');
      if (micUnmutedResponse.ok) {
        const micUnmutedArrayBuffer = await micUnmutedResponse.arrayBuffer();
        this.sounds.micUnmuted = await this.audioContext.decodeAudioData(micUnmutedArrayBuffer);
      }

      // Загружаем звук глобального мьюта
      const globalMutedResponse = await fetch('/global-muted.mp3');
      if (globalMutedResponse.ok) {
        const globalMutedArrayBuffer = await globalMutedResponse.arrayBuffer();
        this.sounds.globalMuted = await this.audioContext.decodeAudioData(globalMutedArrayBuffer);
      }

      // Загружаем звук глобального размьюта
      const globalUnmutedResponse = await fetch('/global-unmuted.mp3');
      if (globalUnmutedResponse.ok) {
        const globalUnmutedArrayBuffer = await globalUnmutedResponse.arrayBuffer();
        this.sounds.globalUnmuted = await this.audioContext.decodeAudioData(globalUnmutedArrayBuffer);
      }

      console.log('AudioNotificationManager: Sounds loaded successfully');
    } catch (error) {
      console.warn('AudioNotificationManager: Failed to load some sounds:', error);
    }
  }

  /**
   * Воспроизведение звука подключения пользователя
   */
  async playUserJoinedSound() {
    await this.playSound('userJoined', 0.7); // Громкость 30%
  }

  /**
   * Воспроизведение звука отключения пользователя
   */
  async playUserLeftSound() {
    await this.playSound('userLeft', 0.7); // Громкость 30%
  }

  /**
   * Воспроизведение звука мьюта микрофона (только локально)
   */
  async playMicMutedSound() {
    await this.playSound('micMuted', 0.5); // Громкость 50%
  }

  /**
   * Воспроизведение звука размьюта микрофона (только локально)
   */
  async playMicUnmutedSound() {
    await this.playSound('micUnmuted', 0.5); // Громкость 50%
  }

  /**
   * Воспроизведение звука глобального мьюта (только локально)
   */
  async playGlobalMutedSound() {
    await this.playSound('globalMuted', 0.6); // Громкость 60%
  }

  /**
   * Воспроизведение звука глобального размьюта (только локально)
   */
  async playGlobalUnmutedSound() {
    await this.playSound('globalUnmuted', 0.6); // Громкость 60%
  }

  /**
   * Воспроизведение звука
   * @param {string} soundName - Название звука
   * @param {number} volume - Громкость (0-1)
   */
  async playSound(soundName, volume = 0.5) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!this.audioContext || this.audioContext.state === 'closed') {
      console.warn('AudioNotificationManager: AudioContext not available');
      return;
    }

    // Возобновляем контекст если он приостановлен
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

    const sound = this.sounds[soundName];
    if (!sound) {
      console.warn(`AudioNotificationManager: Sound ${soundName} not loaded`);
      return;
    }

    try {
      // Создаем источник звука
      const source = this.audioContext.createBufferSource();
      const gainNode = this.audioContext.createGain();
      
      source.buffer = sound;
      gainNode.gain.value = volume;
      
      // Подключаем цепочку: source -> gain -> destination
      source.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      
      // Воспроизводим звук
      source.start(0);
      
      console.log(`AudioNotificationManager: Playing ${soundName} sound`);
    } catch (error) {
      console.error(`AudioNotificationManager: Failed to play ${soundName} sound:`, error);
    }
  }

  /**
   * Очистка ресурсов
   */
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
      globalUnmuted: null
    };
    this.isInitialized = false;
  }
}

// Создаем глобальный экземпляр
export const audioNotificationManager = new AudioNotificationManager();

// Экспортируем также класс для создания отдельных экземпляров
export { AudioNotificationManager };
