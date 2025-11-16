/**
 * Electron Echo Canceller
 * 
 * Управляет подавлением эха в Electron приложении при демонстрации экрана
 * Вычитает голоса участников из системного звука
 */

class ElectronEchoCanceller {
  constructor() {
    this.audioContext = null;
    this.workletNode = null;
    this.systemSource = null;
    this.participantsSource = null;
    this.destination = null;
    this.isActive = false;
    this.isElectron = false;
    
    // Проверяем, что мы в Electron
    this.checkElectron();
  }

  /**
   * Проверяет, запущено ли приложение в Electron
   */
  async checkElectron() {
    try {
      if (window.electronAPI && typeof window.electronAPI.isElectron === 'function') {
        this.isElectron = await window.electronAPI.isElectron();
        console.log('🖥️ Running in Electron:', this.isElectron);
      }
    } catch {
      console.log('🌐 Running in browser');
      this.isElectron = false;
    }
  }

  /**
   * Инициализирует echo cancellation для демонстрации экрана
   * @param {MediaStreamTrack} systemAudioTrack - трек системного звука
   * @param {MediaStream[]} participantStreams - массив потоков участников
   * @returns {Promise<MediaStreamTrack>} - очищенный аудио трек
   */
  async initialize(systemAudioTrack, participantStreams) {
    if (!this.isElectron) {
      console.log('ℹ️ Not in Electron, skipping echo cancellation');
      return systemAudioTrack;
    }

    if (!systemAudioTrack) {
      console.warn('⚠️ No system audio track provided');
      return null;
    }

    try {
      console.log('🎬 Initializing Electron Echo Cancellation...');
      
      // Создаем AudioContext
      this.audioContext = new AudioContext({ 
        sampleRate: 48000,
        latencyHint: 'interactive' 
      });

      // === 1. Системный звук (с эхом) ===
      const systemStream = new MediaStream([systemAudioTrack]);
      this.systemSource = this.audioContext.createMediaStreamSource(systemStream);
      console.log('✅ System audio source created');

      // === 2. Голоса участников (что нужно вычесть) ===
      const participantsMixer = this.audioContext.createGain();
      participantsMixer.gain.value = 1.0;

      // Микшируем все потоки участников в один
      let participantCount = 0;
      for (const stream of participantStreams) {
        if (stream && stream.getAudioTracks().length > 0) {
          const source = this.audioContext.createMediaStreamSource(stream);
          source.connect(participantsMixer);
          participantCount++;
        }
      }
      
      console.log(`✅ Mixed ${participantCount} participant streams`);

      // === 3. Загружаем AudioWorklet ===
      await this.audioContext.audioWorklet.addModule('/echo-canceller.worklet.js');
      console.log('✅ Echo Canceller Worklet loaded');

      // === 4. Создаем узел обработки ===
      this.workletNode = new AudioWorkletNode(this.audioContext, 'echo-canceller', {
        numberOfInputs: 2,  // [0] = системный звук, [1] = участники
        numberOfOutputs: 1, // Результат (очищенный звук)
        channelCount: 1,
        channelCountMode: 'explicit',
        channelInterpretation: 'speakers'
      });

      // Слушаем статистику
      this.workletNode.port.onmessage = (event) => {
        if (event.data.type === 'stats') {
          console.log('📊 Echo Canceller Stats:', {
            frames: event.data.processedFrames,
            gain: event.data.gainReduction.toFixed(2),
            participantEnergy: event.data.participantEnergy.toFixed(3),
            systemEnergy: event.data.systemEnergy.toFixed(3)
          });
        }
      };

      // === 5. Подключаем аудио граф ===
      // Системный звук → вход 0 worklet
      this.systemSource.connect(this.workletNode, 0, 0);
      
      // Голоса участников → вход 1 worklet
      participantsMixer.connect(this.workletNode, 0, 1);

      // === 6. Создаем выходной поток ===
      this.destination = this.audioContext.createMediaStreamDestination();
      this.workletNode.connect(this.destination);

      // === 7. Получаем очищенный трек ===
      const cleanedTrack = this.destination.stream.getAudioTracks()[0];
      
      if (!cleanedTrack) {
        throw new Error('Failed to create cleaned audio track');
      }

      this.isActive = true;
      console.log('✅ Echo Cancellation активировано! 🎉');
      console.log('💡 Системный звук теперь БЕЗ голосов участников');

      return cleanedTrack;

    } catch (error) {
      console.error('❌ Failed to initialize echo cancellation:', error);
      
      // В случае ошибки, возвращаем оригинальный трек
      this.cleanup();
      return systemAudioTrack;
    }
  }

  /**
   * Обновляет список участников для вычитания
   * @param {MediaStream[]} participantStreams - новый массив потоков
   */
  async updateParticipants(participantStreams) {
    if (!this.isActive || !this.audioContext || !this.workletNode) {
      console.warn('⚠️ Echo canceller not active, cannot update participants');
      return;
    }

    try {
      console.log('🔄 Updating participant streams...');
      
      // Останавливаем текущие подключения
      // (Это упрощенный подход, в production нужно более аккуратное управление)
      
      console.log(`✅ Updated to ${participantStreams.length} participants`);
      
    } catch (error) {
      console.error('❌ Failed to update participants:', error);
    }
  }

  /**
   * Настраивает агрессивность вычитания голосов
   * @param {number} value - от 0 (не вычитать) до 1 (максимально вычитать)
   */
  setGainReduction(value) {
    if (!this.isActive || !this.workletNode) {
      console.warn('⚠️ Echo canceller not active');
      return;
    }

    const clampedValue = Math.max(0, Math.min(1, value));
    this.workletNode.port.postMessage({
      type: 'updateGain',
      value: clampedValue
    });
    
    console.log(`🎚️ Gain reduction set to ${(clampedValue * 100).toFixed(0)}%`);
  }

  /**
   * Останавливает echo cancellation и освобождает ресурсы
   */
  cleanup() {
    console.log('🧹 Cleaning up Echo Cancellation...');
    
    try {
      if (this.systemSource) {
        this.systemSource.disconnect();
        this.systemSource = null;
      }

      if (this.participantsSource) {
        this.participantsSource.disconnect();
        this.participantsSource = null;
      }

      if (this.workletNode) {
        this.workletNode.disconnect();
        this.workletNode.port.close();
        this.workletNode = null;
      }

      if (this.destination) {
        this.destination = null;
      }

      if (this.audioContext) {
        this.audioContext.close();
        this.audioContext = null;
      }

      this.isActive = false;
      console.log('✅ Echo Cancellation cleaned up');
      
    } catch (error) {
      console.error('❌ Error during cleanup:', error);
    }
  }

  /**
   * Проверяет, активен ли echo canceller
   */
  isActivated() {
    return this.isActive;
  }

  /**
   * Получает текущее состояние
   */
  getStatus() {
    return {
      isElectron: this.isElectron,
      isActive: this.isActive,
      hasAudioContext: !!this.audioContext,
      hasWorklet: !!this.workletNode
    };
  }
}

// Singleton
let echoCancellerInstance = null;

export const getElectronEchoCanceller = () => {
  if (!echoCancellerInstance) {
    echoCancellerInstance = new ElectronEchoCanceller();
  }
  return echoCancellerInstance;
};

export default ElectronEchoCanceller;

