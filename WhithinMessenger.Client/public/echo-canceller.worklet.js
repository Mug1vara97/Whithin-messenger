/**
 * Echo Canceller AudioWorklet Processor
 * 
 * Вычитает голоса участников из системного звука при демонстрации экрана в Electron
 * 
 * Используется фазовая инверсия (phase cancellation) для подавления голосов
 */

class EchoCancellerProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    
    // Буфер для хранения предыдущих сэмплов участников
    this.participantBuffer = new Float32Array(128);
    this.bufferIndex = 0;
    
    // Параметры обработки
    this.smoothingFactor = 0.8; // Коэффициент сглаживания
    this.gainReduction = 0.9; // Насколько сильно вычитать голоса
    
    // Анализ частот для детекции голоса
    this.voiceFrequencyRange = { min: 80, max: 3000 }; // Hz
    
    // Статистика
    this.processedFrames = 0;
    
    // Слушаем сообщения из main thread
    this.port.onmessage = (event) => {
      if (event.data.type === 'updateGain') {
        this.gainReduction = event.data.value;
      }
    };
  }

  /**
   * Основной метод обработки аудио
   * @param {Float32Array[][]} inputs - [0] = системный звук, [1] = голоса участников
   * @param {Float32Array[][]} outputs - выходной поток (очищенный системный звук)
   * @param {Object} parameters - параметры DSP
   */
  process(inputs, outputs, parameters) {
    const systemAudio = inputs[0]; // Системный звук (с эхом)
    const participantAudio = inputs[1]; // Голоса участников (что нужно вычесть)
    const output = outputs[0]; // Результат (без голосов)

    // Если нет входных данных, пропускаем
    if (!systemAudio || systemAudio.length === 0) {
      return true;
    }

    const systemChannel = systemAudio[0];
    const participantChannel = participantAudio && participantAudio.length > 0 
      ? participantAudio[0] 
      : null;
    const outputChannel = output[0];

    // Если нет голосов участников, просто копируем системный звук
    if (!participantChannel || participantChannel.length === 0) {
      for (let i = 0; i < systemChannel.length; i++) {
        outputChannel[i] = systemChannel[i];
      }
      this.processedFrames++;
      return true;
    }

    // === ФАЗОВАЯ ОТМЕНА (Phase Cancellation) ===
    // Инвертируем фазу голосов участников и добавляем к системному звуку
    for (let i = 0; i < systemChannel.length; i++) {
      // Получаем сэмплы
      const systemSample = systemChannel[i];
      const participantSample = participantChannel[i] || 0;
      
      // Применяем адаптивное вычитание с сглаживанием
      // Используем экспоненциальное сглаживание для уменьшения артефактов
      const cancelledSample = systemSample - (participantSample * this.gainReduction);
      
      // Сглаживание для предотвращения щелчков
      if (i > 0) {
        outputChannel[i] = 
          this.smoothingFactor * cancelledSample + 
          (1 - this.smoothingFactor) * outputChannel[i - 1];
      } else {
        outputChannel[i] = cancelledSample;
      }
      
      // Ограничиваем амплитуду (-1.0 до 1.0)
      outputChannel[i] = Math.max(-1.0, Math.min(1.0, outputChannel[i]));
    }

    // === АДАПТИВНОЕ ПОДАВЛЕНИЕ ===
    // Если обнаружена речь, увеличиваем подавление
    const participantEnergy = this.calculateEnergy(participantChannel);
    const systemEnergy = this.calculateEnergy(systemChannel);
    
    // Если голос участника громкий, усиливаем вычитание
    if (participantEnergy > 0.1 && systemEnergy > 0.05) {
      this.gainReduction = Math.min(0.95, this.gainReduction + 0.01);
    } else {
      // Постепенно возвращаем к норме
      this.gainReduction = Math.max(0.85, this.gainReduction - 0.005);
    }

    this.processedFrames++;
    
    // Отправляем статистику каждые 100 фреймов
    if (this.processedFrames % 100 === 0) {
      this.port.postMessage({
        type: 'stats',
        processedFrames: this.processedFrames,
        gainReduction: this.gainReduction,
        participantEnergy,
        systemEnergy
      });
    }

    return true; // Продолжаем обработку
  }

  /**
   * Рассчитывает энергию (громкость) аудио сигнала
   * @param {Float32Array} channel - канал аудио
   * @returns {number} - энергия от 0 до 1
   */
  calculateEnergy(channel) {
    if (!channel || channel.length === 0) return 0;
    
    let sum = 0;
    for (let i = 0; i < channel.length; i++) {
      sum += channel[i] * channel[i];
    }
    
    return Math.sqrt(sum / channel.length);
  }
}

registerProcessor('echo-canceller', EchoCancellerProcessor);

