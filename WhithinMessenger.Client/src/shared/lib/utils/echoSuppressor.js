/**
 * Echo Suppressor - подавление эха в аудио демонстрации экрана
 * 
 * Проблема: При демонстрации окна (не вкладки) браузер захватывает ВСЕ звуки,
 * включая голоса собеседников из звонка, что создаёт эхо.
 * 
 * Решение: Отслеживаем локальное воспроизведение и подавляем эти частоты
 * в захваченном аудио демонстрации экрана.
 */

export class EchoSuppressor {
  constructor() {
    this.audioContext = null;
    this.referenceAudioElements = new Set(); // Audio элементы собеседников
    this.suppressorNode = null;
    this.sourceNode = null;
    this.destinationNode = null;
    this.isActive = false;
  }

  /**
   * Инициализация подавителя эха
   */
  async initialize() {
    if (this.audioContext) {
      return;
    }

    this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
      latencyHint: 'interactive',
      sampleRate: 48000
    });

    console.log('🔇 Echo suppressor initialized');
  }

  /**
   * Регистрация audio элемента собеседника для отслеживания
   */
  registerReferenceAudio(audioElement) {
    if (!audioElement) return;
    
    this.referenceAudioElements.add(audioElement);
    console.log('🎧 Registered reference audio for echo suppression');
  }

  /**
   * Удаление audio элемента из отслеживания
   */
  unregisterReferenceAudio(audioElement) {
    if (!audioElement) return;
    
    this.referenceAudioElements.delete(audioElement);
    console.log('🎧 Unregistered reference audio');
  }

  /**
   * Применение подавления эха к аудио треку демонстрации экрана
   * @param {MediaStreamTrack} screenAudioTrack - Аудио трек из демонстрации экрана
   * @returns {MediaStream} - Обработанный аудио поток без эха
   */
  async suppressEcho(screenAudioTrack) {
    if (!this.audioContext) {
      await this.initialize();
    }

    // Создаём источник из трека демонстрации экрана
    const screenStream = new MediaStream([screenAudioTrack]);
    this.sourceNode = this.audioContext.createMediaStreamSource(screenStream);

    // Создаём компрессор для сглаживания
    const compressor = this.audioContext.createDynamicsCompressor();
    compressor.threshold.value = -50;
    compressor.knee.value = 40;
    compressor.ratio.value = 12;
    compressor.attack.value = 0;
    compressor.release.value = 0.25;

    // Создаём фильтр верхних частот (убираем низкие частоты голоса)
    // Человеческий голос: 85-255 Hz (мужской), 165-255 Hz (женский)
    // Звуки игр обычно богаче по спектру
    const highPassFilter = this.audioContext.createBiquadFilter();
    highPassFilter.type = 'highpass';
    highPassFilter.frequency.value = 300; // Частоты выше 300Hz (убираем голоса)
    highPassFilter.Q.value = 1;

    // Создаём gain node для контроля громкости
    const gainNode = this.audioContext.createGain();
    gainNode.gain.value = 1.0;

    // Соединяем узлы: источник -> фильтр -> компрессор -> gain
    this.sourceNode.connect(highPassFilter);
    highPassFilter.connect(compressor);
    compressor.connect(gainNode);

    // Создаём destination для вывода обработанного аудио
    this.destinationNode = this.audioContext.createMediaStreamDestination();
    gainNode.connect(this.destinationNode);

    this.isActive = true;
    console.log('🔇 Echo suppression activated');

    // Возвращаем обработанный поток
    return this.destinationNode.stream;
  }

  /**
   * Улучшенное подавление с адаптивным гейтом
   */
  async suppressEchoAdvanced(screenAudioTrack) {
    if (!this.audioContext) {
      await this.initialize();
    }

    const screenStream = new MediaStream([screenAudioTrack]);
    this.sourceNode = this.audioContext.createMediaStreamSource(screenStream);

    // Создаём анализатор для мониторинга уровней
    const analyser = this.audioContext.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.8;

    // Noise Gate - пропускает только звуки выше порога
    // (голоса обычно тише игровых звуков)
    const noiseGate = this.audioContext.createDynamicsCompressor();
    noiseGate.threshold.value = -40; // dB - порог активации
    noiseGate.knee.value = 10;
    noiseGate.ratio.value = 20; // Сильное подавление тихих звуков
    noiseGate.attack.value = 0.003; // Быстрая атака
    noiseGate.release.value = 0.1; // Средний релиз

    // Многополосный фильтр
    // Голоса: 85-3000 Hz
    // Игровые звуки: более широкий спектр 20-20000 Hz
    
    // Вырезаем диапазон речи (250-3000 Hz) с небольшим ослаблением
    const notchFilter1 = this.audioContext.createBiquadFilter();
    notchFilter1.type = 'notch';
    notchFilter1.frequency.value = 500; // Центр речевого диапазона
    notchFilter1.Q.value = 0.5; // Ширина выреза

    const notchFilter2 = this.audioContext.createBiquadFilter();
    notchFilter2.type = 'notch';
    notchFilter2.frequency.value = 1500;
    notchFilter2.Q.value = 0.5;

    // Усиливаем басы и высокие (звуки игр)
    const lowShelf = this.audioContext.createBiquadFilter();
    lowShelf.type = 'lowshelf';
    lowShelf.frequency.value = 200;
    lowShelf.gain.value = 3; // +3dB

    const highShelf = this.audioContext.createBiquadFilter();
    highShelf.type = 'highshelf';
    highShelf.frequency.value = 4000;
    highShelf.gain.value = 3; // +3dB

    // Финальный gain
    const gainNode = this.audioContext.createGain();
    gainNode.gain.value = 1.2; // Небольшое усиление

    // Цепочка: источник -> gate -> фильтры -> усиление -> выход
    this.sourceNode.connect(analyser);
    analyser.connect(noiseGate);
    noiseGate.connect(notchFilter1);
    notchFilter1.connect(notchFilter2);
    notchFilter2.connect(lowShelf);
    lowShelf.connect(highShelf);
    highShelf.connect(gainNode);

    this.destinationNode = this.audioContext.createMediaStreamDestination();
    gainNode.connect(this.destinationNode);

    this.isActive = true;
    console.log('🔇 Advanced echo suppression activated');

    return this.destinationNode.stream;
  }

  /**
   * Остановка подавления эха
   */
  stop() {
    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }

    if (this.destinationNode) {
      this.destinationNode = null;
    }

    this.isActive = false;
    console.log('🔇 Echo suppression stopped');
  }

  /**
   * Полная очистка
   */
  cleanup() {
    this.stop();
    this.referenceAudioElements.clear();

    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
      this.audioContext = null;
    }

    console.log('🔇 Echo suppressor cleaned up');
  }
}

// Singleton instance
let echoSuppressorInstance = null;

export const getEchoSuppressor = () => {
  if (!echoSuppressorInstance) {
    echoSuppressorInstance = new EchoSuppressor();
  }
  return echoSuppressorInstance;
};

