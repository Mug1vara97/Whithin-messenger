class VoiceDetectorProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.lastSpeakingState = false;
    this.speakingFrames = 0;
    this.silentFrames = 0;
    this.FRAMES_THRESHOLD = 3; // Нужно 3 кадра подряд для изменения состояния (предотвращает дрожание)
    this.SPEAKING_THRESHOLD = -50; // Порог в децибелах
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0]) return true;

    const samples = input[0];
    
    // Вычисляем RMS (Root Mean Square) - среднеквадратичное значение
    let rms = 0;
    for (let i = 0; i < samples.length; i++) {
      rms += samples[i] * samples[i];
    }
    rms = Math.sqrt(rms / samples.length);

    // Конвертируем в децибелы
    const db = 20 * Math.log10(Math.max(rms, 1e-10));

    // Проверяем, превышает ли уровень порог
    const isSpeakingNow = db > this.SPEAKING_THRESHOLD;

    // Обновляем счетчики кадров
    if (isSpeakingNow) {
      this.speakingFrames++;
      this.silentFrames = 0;
    } else {
      this.speakingFrames = 0;
      this.silentFrames++;
    }

    // Определяем новое состояние с гистерезисом
    let shouldBeSpeaking = this.lastSpeakingState;
    
    if (this.speakingFrames >= this.FRAMES_THRESHOLD) {
      shouldBeSpeaking = true;
    } else if (this.silentFrames >= this.FRAMES_THRESHOLD) {
      shouldBeSpeaking = false;
    }

    // Отправляем сообщение только при изменении состояния
    if (shouldBeSpeaking !== this.lastSpeakingState) {
      this.lastSpeakingState = shouldBeSpeaking;
      this.port.postMessage({
        speaking: shouldBeSpeaking,
        level: db
      });
    }

    return true;
  }
}

registerProcessor('voice-detector', VoiceDetectorProcessor);

