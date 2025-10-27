import {
  loadSpeex,
  SpeexWorkletNode,
  loadRnnoise,
  RnnoiseWorkletNode,
  NoiseGateWorkletNode
} from '@sapphi-red/web-noise-suppressor';
import speexWorkletPath from '@sapphi-red/web-noise-suppressor/speexWorklet.js?url';
import noiseGateWorkletPath from '@sapphi-red/web-noise-suppressor/noiseGateWorklet.js?url';
import rnnoiseWorkletPath from '@sapphi-red/web-noise-suppressor/rnnoiseWorklet.js?url';
import speexWasmPath from '@sapphi-red/web-noise-suppressor/speex.wasm?url';
import rnnoiseWasmPath from '@sapphi-red/web-noise-suppressor/rnnoise.wasm?url';
import rnnoiseWasmSimdPath from '@sapphi-red/web-noise-suppressor/rnnoise_simd.wasm?url';

export class NoiseSuppressionManager {
  constructor() {
    this.audioContext = null;
    this.sourceNode = null;
    this.destinationNode = null;
    this.gainNode = null;
    this.rnnWorkletNode = null;
    this.speexWorkletNode = null;
    this.noiseGateNode = null;
    this.currentMode = null;
    this.producer = null;
    this.originalStream = null;
    this.processedStream = null;
    this._isInitialized = false;
    this.wasmBinaries = {
      speex: null,
      rnnoise: null
    };
  }

  async initialize(stream, audioContext) {
    try {
      this.cleanup();

      if (!stream) {
        console.error('No stream provided');
        return false;
      }

      this.originalStream = stream;
      
      // Используем переданный audioContext или создаем новый
      this.audioContext = audioContext || new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: 48000,
        latencyHint: 'interactive'
      });

      // ВАЖНО: Убедимся что AudioContext не создает локальное воспроизведение
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      this.processedStream = new MediaStream();

      console.log('NoiseSuppressionManager: Loading WASM binaries...');
      const [speexWasmBinary, rnnoiseWasmBinary] = await Promise.all([
        loadSpeex({ url: speexWasmPath }),
        loadRnnoise({
          url: rnnoiseWasmPath,
          simdUrl: rnnoiseWasmSimdPath
        })
      ]);

      this.wasmBinaries.speex = speexWasmBinary;
      this.wasmBinaries.rnnoise = rnnoiseWasmBinary;
      console.log('NoiseSuppressionManager: WASM binaries loaded');

      // Создаем source node (не подключаем к destination для предотвращения локального воспроизведения)
      this.sourceNode = this.audioContext.createMediaStreamSource(stream);
      console.log('NoiseSuppressionManager: Source node created');

      // Создаем destination для обработанного потока
      this.destinationNode = this.audioContext.createMediaStreamDestination();
      
      const destinationTrack = this.destinationNode.stream.getAudioTracks()[0];
      if (destinationTrack) {
        this.processedStream.addTrack(destinationTrack);
        console.log('NoiseSuppressionManager: Processed stream track added');
      } else {
        throw new Error('No audio track in destination node');
      }

      console.log('NoiseSuppressionManager: Loading worklet modules...');
      await Promise.all([
        this.audioContext.audioWorklet.addModule(rnnoiseWorkletPath),
        this.audioContext.audioWorklet.addModule(speexWorkletPath),
        this.audioContext.audioWorklet.addModule(noiseGateWorkletPath)
      ]);
      console.log('NoiseSuppressionManager: Worklet modules loaded');

      this.rnnWorkletNode = new RnnoiseWorkletNode(this.audioContext, {
        wasmBinary: this.wasmBinaries.rnnoise,
        maxChannels: 1,
        vadOffset: 0.25,
        gainOffset: 10,  // Изменено с -25 на +10 (усиление вместо подавления)
        enableVAD: true
      });

      this.speexWorkletNode = new SpeexWorkletNode(this.audioContext, {
        wasmBinary: this.wasmBinaries.speex,
        maxChannels: 1,
        denoise: true,
        aggressiveness: 15,
        vadOffset: 1.5,
        enableVAD: true,
        gainOffset: 5  // Изменено с -15 на +5 (усиление вместо подавления)
      });

      this.noiseGateNode = new NoiseGateWorkletNode(this.audioContext, {
        openThreshold: -65,
        closeThreshold: -70,
        holdMs: 150,
        maxChannels: 1 // Изменено на 1 канал для совместимости с getUserMedia
      });

      this.gainNode = this.audioContext.createGain();
      this.gainNode.gain.value = 2.0;  // Увеличено с 1.0 до 2.0 (200% усиление)

      // Создаем High-Pass фильтр для удаления низких частот (звуки клавиатуры, дыхание)
      this.highPassFilter = this.audioContext.createBiquadFilter();
      this.highPassFilter.type = 'highpass';
      this.highPassFilter.frequency.value = 80;  // Срез на 80 Гц - убирает звуки клавиатуры (100-500 Гц), сохраняет речь (80-8000 Гц)
      this.highPassFilter.Q.value = 0.7071;  // Butterworth фильтр (плоская АЧХ)
      console.log('NoiseSuppressionManager: High-pass filter created at 80 Hz');

      // Создаем компрессор для предотвращения клиппинга (искажения при громких звуках)
      this.compressor = this.audioContext.createDynamicsCompressor();
      // Настройка компрессора:
      this.compressor.threshold.value = -24;    // Начинать сжатие при -24 dB
      this.compressor.knee.value = 30;          // Плавное сжатие (soft knee)
      this.compressor.ratio.value = 12;         // Коэффициент сжатия 12:1 (почти лимитер)
      this.compressor.attack.value = 0.003;     // Быстрая атака (3 мс)
      this.compressor.release.value = 0.25;     // Быстрое восстановление (250 мс)
      console.log('NoiseSuppressionManager: Compressor created (threshold: -24dB, ratio: 12:1)');

      // Подключаем source -> highpass -> gain -> compressor -> destination
      this.sourceNode.connect(this.highPassFilter);
      this.highPassFilter.connect(this.gainNode);
      this.gainNode.connect(this.compressor);
      this.compressor.connect(this.destinationNode);
      console.log('NoiseSuppressionManager: Audio nodes connected: source -> highpass -> gain -> compressor -> destination');

      this._isInitialized = true;
      console.log('NoiseSuppressionManager: Initialization completed successfully');
      return true;
    } catch (error) {
      console.error('Failed to initialize noise suppression:', error);
      this.cleanup();
      return false;
    }
  }

  isInitialized() {
    return this._isInitialized;
  }

  getProcessedStream() {
    return this.processedStream;
  }

  async enable(mode = 'rnnoise') {
    try {
      if (!this._isInitialized) {
        console.error('NoiseSuppressionManager: Not initialized');
        return false;
      }

      console.log(`NoiseSuppressionManager: Enabling noise suppression with mode: ${mode}`);
      console.log('NoiseSuppressionManager: Current mode:', this.currentMode);

      // Отключаем текущие соединения
      try {
        this.sourceNode.disconnect();
        console.log('NoiseSuppressionManager: Source node disconnected');
      } catch (e) {
        console.warn('NoiseSuppressionManager: Error disconnecting source node:', e);
      }
      
      try {
        if (this.highPassFilter) {
          this.highPassFilter.disconnect();
          console.log('NoiseSuppressionManager: High-pass filter disconnected');
        }
      } catch (e) {
        console.warn('NoiseSuppressionManager: Error disconnecting high-pass filter:', e);
      }
      
      try {
        this.gainNode.disconnect();
        console.log('NoiseSuppressionManager: Gain node disconnected');
      } catch (e) {
        console.warn('NoiseSuppressionManager: Error disconnecting gain node:', e);
      }
      
      try {
        if (this.compressor) {
          this.compressor.disconnect();
          console.log('NoiseSuppressionManager: Compressor disconnected');
        }
      } catch (e) {
        console.warn('NoiseSuppressionManager: Error disconnecting compressor:', e);
      }

      let processingNode;
      switch (mode) {
        case 'rnnoise':
          processingNode = this.rnnWorkletNode;
          console.log('NoiseSuppressionManager: Selected RNNoise worklet');
          break;
        case 'speex':
          processingNode = this.speexWorkletNode;
          console.log('NoiseSuppressionManager: Selected Speex worklet');
          break;
        case 'noisegate':
          processingNode = this.noiseGateNode;
          console.log('NoiseSuppressionManager: Selected Noise Gate worklet');
          break;
        case 'combined':
          // Цепочка: source -> highpass -> gain -> noisegate -> rnnoise -> compressor -> destination
          this.sourceNode.connect(this.highPassFilter);
          this.highPassFilter.connect(this.gainNode);
          this.gainNode.connect(this.noiseGateNode);
          this.noiseGateNode.connect(this.rnnWorkletNode);
          this.rnnWorkletNode.connect(this.compressor);
          this.compressor.connect(this.destinationNode);
          this.currentMode = mode;
          console.log('NoiseSuppressionManager: Enabled in combined mode with high-pass and compressor');
          return true;
        default:
          throw new Error('Invalid noise suppression mode');
      }

      // Подключаем цепочку: source -> highpass -> gain -> processing -> compressor -> destination
      this.sourceNode.connect(this.highPassFilter);
      this.highPassFilter.connect(this.gainNode);
      this.gainNode.connect(processingNode);
      processingNode.connect(this.compressor);
      this.compressor.connect(this.destinationNode);
      console.log(`NoiseSuppressionManager: Audio chain connected: source -> highpass -> gain -> ${mode} -> compressor -> destination`);

      this.currentMode = mode;

      if (this.producer) {
        try {
          const newTrack = this.processedStream.getAudioTracks()[0];
          if (newTrack) {
            console.log('NoiseSuppressionManager: Replacing producer track...');
            await this.producer.replaceTrack({ track: newTrack });
            console.log('NoiseSuppressionManager: Producer track replaced successfully');
          }
        } catch (error) {
          console.error('NoiseSuppressionManager: Error replacing producer track:', error);
          return false;
        }
      } else {
        console.log('NoiseSuppressionManager: No producer set, skipping track replacement');
      }

      console.log(`NoiseSuppressionManager: Noise suppression enabled successfully in ${mode} mode`);
      return true;
    } catch (error) {
      console.error('NoiseSuppressionManager: Error enabling noise suppression:', error);
      return false;
    }
  }

  // Метод для изменения усиления микрофона (1.0 = 100%, 2.0 = 200%, и т.д.)
  setMicrophoneGain(gainValue) {
    try {
      if (!this._isInitialized || !this.gainNode) {
        console.warn('NoiseSuppressionManager: Not initialized or no gain node');
        return false;
      }

      // Ограничиваем значение от 0.1 до 5.0 (от 10% до 500%)
      const clampedGain = Math.max(0.1, Math.min(5.0, gainValue));
      this.gainNode.gain.value = clampedGain;
      console.log(`NoiseSuppressionManager: Microphone gain set to ${clampedGain} (${Math.round(clampedGain * 100)}%)`);
      return true;
    } catch (error) {
      console.error('NoiseSuppressionManager: Error setting microphone gain:', error);
      return false;
    }
  }

  // Получить текущее усиление
  getMicrophoneGain() {
    if (!this._isInitialized || !this.gainNode) {
      return 1.0;
    }
    return this.gainNode.gain.value;
  }

  // Метод для настройки частоты среза High-Pass фильтра
  setHighPassFrequency(frequency) {
    try {
      if (!this._isInitialized || !this.highPassFilter) {
        console.warn('NoiseSuppressionManager: Not initialized or no high-pass filter');
        return false;
      }

      // Ограничиваем значение от 20 Гц до 500 Гц
      // 20-50 Гц - убирает только очень низкие частоты (гул, вибрации)
      // 80-100 Гц - убирает звуки клавиатуры, дыхание (рекомендуется)
      // 150-300 Гц - агрессивная фильтрация (может повлиять на голос)
      const clampedFreq = Math.max(20, Math.min(500, frequency));
      this.highPassFilter.frequency.value = clampedFreq;
      console.log(`NoiseSuppressionManager: High-pass filter frequency set to ${clampedFreq} Hz`);
      return true;
    } catch (error) {
      console.error('NoiseSuppressionManager: Error setting high-pass frequency:', error);
      return false;
    }
  }

  // Получить текущую частоту среза
  getHighPassFrequency() {
    if (!this._isInitialized || !this.highPassFilter) {
      return 80;
    }
    return this.highPassFilter.frequency.value;
  }

  // Включить/выключить High-Pass фильтр
  setHighPassEnabled(enabled) {
    try {
      if (!this._isInitialized) {
        console.warn('NoiseSuppressionManager: Not initialized');
        return false;
      }

      // Отключаем все соединения
      this.sourceNode.disconnect();
      
      if (enabled && this.highPassFilter) {
        // Включен: source -> highpass -> gain -> [processing] -> destination
        this.sourceNode.connect(this.highPassFilter);
        
        // Если есть активная обработка, подключаем через неё
        if (this.currentMode && this.currentMode !== 'passthrough') {
          let processingNode;
          switch (this.currentMode) {
            case 'rnnoise':
              processingNode = this.rnnWorkletNode;
              break;
            case 'speex':
              processingNode = this.speexWorkletNode;
              break;
            case 'noisegate':
              processingNode = this.noiseGateNode;
              break;
          }
          
          if (processingNode) {
            this.highPassFilter.disconnect();
            this.gainNode.disconnect();
            
            this.highPassFilter.connect(this.gainNode);
            this.gainNode.connect(processingNode);
            processingNode.connect(this.destinationNode);
          } else {
            this.highPassFilter.connect(this.gainNode);
            this.gainNode.connect(this.destinationNode);
          }
        } else {
          // Нет активной обработки, прямое соединение
          this.highPassFilter.connect(this.gainNode);
          this.gainNode.connect(this.destinationNode);
        }
        console.log('NoiseSuppressionManager: High-pass filter enabled');
      } else {
        // Выключен: source -> gain -> [processing] -> destination
        if (this.currentMode && this.currentMode !== 'passthrough') {
          let processingNode;
          switch (this.currentMode) {
            case 'rnnoise':
              processingNode = this.rnnWorkletNode;
              break;
            case 'speex':
              processingNode = this.speexWorkletNode;
              break;
            case 'noisegate':
              processingNode = this.noiseGateNode;
              break;
          }
          
          if (processingNode) {
            this.gainNode.disconnect();
            this.sourceNode.connect(this.gainNode);
            this.gainNode.connect(processingNode);
            processingNode.connect(this.destinationNode);
          } else {
            this.sourceNode.connect(this.gainNode);
            this.gainNode.connect(this.destinationNode);
          }
        } else {
          this.sourceNode.connect(this.gainNode);
          this.gainNode.connect(this.destinationNode);
        }
        console.log('NoiseSuppressionManager: High-pass filter disabled');
      }
      
      return true;
    } catch (error) {
      console.error('NoiseSuppressionManager: Error toggling high-pass filter:', error);
      return false;
    }
  }

  async disable() {
    try {
      if (!this._isInitialized) {
        console.error('NoiseSuppressionManager: Not initialized');
        return false;
      }

      console.log('NoiseSuppressionManager: Disabling noise suppression');
      console.log('NoiseSuppressionManager: Current mode:', this.currentMode);

      // Отключаем текущие соединения
      try {
        this.sourceNode.disconnect();
        console.log('NoiseSuppressionManager: Source node disconnected');
      } catch (e) {
        console.warn('NoiseSuppressionManager: Error disconnecting source node:', e);
      }
      
      if (this.currentMode) {
        switch (this.currentMode) {
          case 'rnnoise':
            try {
              this.rnnWorkletNode?.disconnect();
              console.log('NoiseSuppressionManager: RNN worklet disconnected');
            } catch (e) {
              console.warn('NoiseSuppressionManager: Error disconnecting RNN worklet:', e);
            }
            break;
          case 'speex':
            try {
              this.speexWorkletNode?.disconnect();
              console.log('NoiseSuppressionManager: Speex worklet disconnected');
            } catch (e) {
              console.warn('NoiseSuppressionManager: Error disconnecting Speex worklet:', e);
            }
            break;
          case 'noisegate':
            try {
              this.noiseGateNode?.disconnect();
              console.log('NoiseSuppressionManager: Noise gate disconnected');
            } catch (e) {
              console.warn('NoiseSuppressionManager: Error disconnecting noise gate:', e);
            }
            break;
          case 'combined':
            try {
              this.noiseGateNode?.disconnect();
              this.rnnWorkletNode?.disconnect();
              console.log('NoiseSuppressionManager: Combined mode worklets disconnected');
            } catch (e) {
              console.warn('NoiseSuppressionManager: Error disconnecting combined worklets:', e);
            }
            break;
        }
      }
      
      try {
        this.gainNode.disconnect();
        console.log('NoiseSuppressionManager: Gain node disconnected');
      } catch (e) {
        console.warn('NoiseSuppressionManager: Error disconnecting gain node:', e);
      }
      
      try {
        if (this.compressor) {
          this.compressor.disconnect();
          console.log('NoiseSuppressionManager: Compressor disconnected');
        }
      } catch (e) {
        console.warn('NoiseSuppressionManager: Error disconnecting compressor:', e);
      }

      // Подключаем цепочку без обработки: source -> highpass -> gain -> compressor -> destination
      this.sourceNode.connect(this.highPassFilter);
      this.highPassFilter.connect(this.gainNode);
      this.gainNode.connect(this.compressor);
      this.compressor.connect(this.destinationNode);
      console.log('NoiseSuppressionManager: Audio chain reconnected (passthrough mode with high-pass and compressor)');

      this.currentMode = null;

      if (this.producer) {
        try {
          const newTrack = this.processedStream.getAudioTracks()[0];
          if (newTrack) {
            console.log('NoiseSuppressionManager: Replacing producer track with passthrough...');
            await this.producer.replaceTrack({ track: newTrack });
            console.log('NoiseSuppressionManager: Producer track replaced successfully');
          }
        } catch (error) {
          console.error('NoiseSuppressionManager: Error replacing producer track:', error);
          return false;
        }
      } else {
        console.log('NoiseSuppressionManager: No producer set, skipping track replacement');
      }

      console.log('NoiseSuppressionManager: Noise suppression disabled successfully');
      return true;
    } catch (error) {
      console.error('NoiseSuppressionManager: Error disabling noise suppression:', error);
      return false;
    }
  }

  setProducer(producer) {
    this.producer = producer;
  }

  cleanup() {
    try {
      console.log('Starting noise suppression cleanup...');
      
      // Отключаем шумоподавление если включено
      if (this.currentMode) {
        console.log('Disabling current mode:', this.currentMode);
        this.disable();
      }

      // Отключаем все узлы
      try {
        this.sourceNode?.disconnect();
        console.log('Source node disconnected');
      } catch (e) {
        console.warn('Error disconnecting source node:', e);
      }
      
      try {
        this.highPassFilter?.disconnect();
        console.log('High-pass filter disconnected');
      } catch (e) {
        console.warn('Error disconnecting high-pass filter:', e);
      }
      
      try {
        this.gainNode?.disconnect();
        console.log('Gain node disconnected');
      } catch (e) {
        console.warn('Error disconnecting gain node:', e);
      }
      
      try {
        this.compressor?.disconnect();
        console.log('Compressor disconnected');
      } catch (e) {
        console.warn('Error disconnecting compressor:', e);
      }
      
      try {
        this.rnnWorkletNode?.disconnect();
        console.log('RNN worklet node disconnected');
      } catch (e) {
        console.warn('Error disconnecting RNN worklet node:', e);
    }

    try {
        this.speexWorkletNode?.disconnect();
        console.log('Speex worklet node disconnected');
      } catch (e) {
        console.warn('Error disconnecting Speex worklet node:', e);
      }
      
      try {
        this.noiseGateNode?.disconnect();
        console.log('Noise gate node disconnected');
      } catch (e) {
        console.warn('Error disconnecting noise gate node:', e);
      }

      // Уничтожаем worklet nodes
      try {
        this.rnnWorkletNode?.destroy?.();
        console.log('RNN worklet node destroyed');
      } catch (e) {
        console.warn('Error destroying RNN worklet node:', e);
      }
      
      try {
        this.speexWorkletNode?.destroy?.();
        console.log('Speex worklet node destroyed');
      } catch (e) {
        console.warn('Error destroying Speex worklet node:', e);
      }

      // НЕ останавливаем оригинальный поток - он управляется извне
      // if (this.originalStream) {
      //   this.originalStream.getTracks().forEach(track => {
      //     track.stop();
      //   });
      // }

      // Останавливаем только обработанный поток
      if (this.processedStream) {
        this.processedStream.getTracks().forEach(track => {
          try {
            track.stop();
            console.log('Processed track stopped:', track.id);
          } catch (e) {
            console.warn('Error stopping processed track:', e);
          }
        });
      }

      // НЕ закрываем аудио контекст - он используется другими компонентами
      // AudioContext будет закрыт в useVoiceCall при disconnect

      this.audioContext = null;
      this.sourceNode = null;
      this.destinationNode = null;
      this.gainNode = null;
      this.rnnWorkletNode = null;
      this.speexWorkletNode = null;
      this.noiseGateNode = null;
      this.currentMode = null;
      this.producer = null;
      this.originalStream = null;
      this.processedStream = null;
      this._isInitialized = false;
      this.wasmBinaries = {
        speex: null,
        rnnoise: null
      };

      console.log('Noise suppression cleanup completed');
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  }
}
