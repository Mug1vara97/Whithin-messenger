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
        maxChannels: 1, // Изменено на 1 канал для совместимости с getUserMedia
        vadOffset: 0.25,
        gainOffset: -25,
        enableVAD: true
      });

      this.speexWorkletNode = new SpeexWorkletNode(this.audioContext, {
        wasmBinary: this.wasmBinaries.speex,
        maxChannels: 1, // Изменено на 1 канал для совместимости с getUserMedia
        denoise: true,
        aggressiveness: 15,
        vadOffset: 1.5,
        enableVAD: true,
        gainOffset: -15
      });

      this.noiseGateNode = new NoiseGateWorkletNode(this.audioContext, {
        openThreshold: -65,
        closeThreshold: -70,
        holdMs: 150,
        maxChannels: 1 // Изменено на 1 канал для совместимости с getUserMedia
      });

      this.gainNode = this.audioContext.createGain();
      this.gainNode.gain.value = 1.0;

      // Подключаем source -> gain -> destination (без обработки по умолчанию)
      this.sourceNode.connect(this.gainNode);
      this.gainNode.connect(this.destinationNode);
      console.log('NoiseSuppressionManager: Audio nodes connected (passthrough mode)');

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
        this.gainNode.disconnect();
        console.log('NoiseSuppressionManager: Gain node disconnected');
      } catch (e) {
        console.warn('NoiseSuppressionManager: Error disconnecting gain node:', e);
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
          this.sourceNode.connect(this.noiseGateNode);
          this.noiseGateNode.connect(this.rnnWorkletNode);
          this.rnnWorkletNode.connect(this.gainNode);
          this.gainNode.connect(this.destinationNode);
          this.currentMode = mode;
          console.log('NoiseSuppressionManager: Enabled in combined mode');
          return true;
        default:
          throw new Error('Invalid noise suppression mode');
      }

      // Подключаем новую цепочку: source -> gain -> processing -> destination
      this.sourceNode.connect(this.gainNode);
      this.gainNode.connect(processingNode);
      processingNode.connect(this.destinationNode);
      console.log(`NoiseSuppressionManager: Audio chain connected: source -> gain -> ${mode} -> destination`);

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

      // Подключаем прямую цепочку без обработки: source -> gain -> destination
      this.sourceNode.connect(this.gainNode);
      this.gainNode.connect(this.destinationNode);
      console.log('NoiseSuppressionManager: Audio chain reconnected (passthrough mode)');

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
        this.gainNode?.disconnect();
        console.log('Gain node disconnected');
      } catch (e) {
        console.warn('Error disconnecting gain node:', e);
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
