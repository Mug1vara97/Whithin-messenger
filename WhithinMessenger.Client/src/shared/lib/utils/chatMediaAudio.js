/**
 * Утилита для маршрутизации аудио из видео и аудио элементов чата через Web Audio API
 * Это позволяет обойти suppressLocalAudioPlayback при демонстрации экрана
 */

class ChatMediaAudioManager {
  constructor() {
    this.audioContext = null;
    this.connectedElements = new Map(); // Map<HTMLElement, MediaElementAudioSourceNode>
  }

  /**
   * Инициализация аудио контекста
   */
  initialize() {
    if (!this.audioContext || this.audioContext.state === 'closed') {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: 48000,
        latencyHint: 'interactive'
      });
      console.log('ChatMediaAudioManager: AudioContext created');
    }
  }

  /**
   * Подключение видео или аудио элемента к Web Audio API
   * @param {HTMLMediaElement} mediaElement - video или audio элемент
   * @returns {MediaElementAudioSourceNode|null}
   */
  connectMediaElement(mediaElement) {
    if (!mediaElement) {
      console.warn('ChatMediaAudioManager: No media element provided');
      return null;
    }

    // Проверяем, не подключен ли уже этот элемент
    if (this.connectedElements.has(mediaElement)) {
      console.log('ChatMediaAudioManager: Element already connected');
      return this.connectedElements.get(mediaElement);
    }

    try {
      this.initialize();

      // Возобновляем контекст если он приостановлен
      if (this.audioContext.state === 'suspended') {
        this.audioContext.resume();
      }

      // Создаем источник из медиа элемента
      const source = this.audioContext.createMediaElementSource(mediaElement);
      
      // Подключаем к выходу (динамики/наушники)
      source.connect(this.audioContext.destination);
      
      // Сохраняем связь
      this.connectedElements.set(mediaElement, source);
      
      console.log('ChatMediaAudioManager: Media element connected to Web Audio API');
      
      return source;
    } catch (error) {
      console.error('ChatMediaAudioManager: Failed to connect media element:', error);
      return null;
    }
  }

  /**
   * Отключение медиа элемента
   * @param {HTMLMediaElement} mediaElement 
   */
  disconnectMediaElement(mediaElement) {
    if (!mediaElement) return;

    const source = this.connectedElements.get(mediaElement);
    if (source) {
      try {
        source.disconnect();
        this.connectedElements.delete(mediaElement);
        console.log('ChatMediaAudioManager: Media element disconnected');
      } catch (error) {
        console.warn('ChatMediaAudioManager: Error disconnecting media element:', error);
      }
    }
  }

  /**
   * Очистка всех подключений
   */
  cleanup() {
    // Отключаем все элементы
    for (const [element, source] of this.connectedElements) {
      try {
        source.disconnect();
      } catch (error) {
        console.warn('ChatMediaAudioManager: Error during cleanup:', error);
      }
    }
    
    this.connectedElements.clear();
    
    // Закрываем аудио контекст
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
    }
    
    this.audioContext = null;
    console.log('ChatMediaAudioManager: Cleanup completed');
  }

  /**
   * Получить текущее состояние
   */
  getState() {
    return {
      contextState: this.audioContext?.state,
      connectedElementsCount: this.connectedElements.size,
      isInitialized: !!this.audioContext
    };
  }
}

// Создаем глобальный экземпляр
export const chatMediaAudioManager = new ChatMediaAudioManager();

// Экспортируем также класс
export { ChatMediaAudioManager };

