// Менеджер подавления шума
export class NoiseSuppressionManager {
  constructor() {
    this.audioContext = null;
    this.workletNode = null;
    this.isEnabled = false;
    this.mode = 'medium';
  }

  async initialize(audioContext) {
    this.audioContext = audioContext;
    
    try {
      // Загрузка worklet для подавления шума
      await this.audioContext.audioWorklet.addModule('/voiceDetector.worklet.js');
      this.workletNode = new AudioWorkletNode(this.audioContext, 'voice-detector');
    } catch (error) {
      console.warn('Failed to load noise suppression worklet:', error);
    }
  }

  setMode(mode) {
    this.mode = mode;
    if (this.workletNode) {
      this.workletNode.port.postMessage({ type: 'setMode', mode });
    }
  }

  setEnabled(enabled) {
    this.isEnabled = enabled;
    if (this.workletNode) {
      this.workletNode.port.postMessage({ type: 'setEnabled', enabled });
    }
  }

  processAudio(inputStream) {
    if (!this.audioContext || !this.isEnabled) {
      return inputStream;
    }

    try {
      const source = this.audioContext.createMediaStreamSource(inputStream);
      
      if (this.workletNode) {
        source.connect(this.workletNode);
        return this.workletNode;
      }
      
      return source;
    } catch (error) {
      console.error('Error processing audio with noise suppression:', error);
      return inputStream;
    }
  }

  getSupportedModes() {
    return [
      { value: 'off', label: 'Off' },
      { value: 'low', label: 'Low' },
      { value: 'medium', label: 'Medium' },
      { value: 'high', label: 'High' }
    ];
  }
}

export const noiseSuppressionManager = new NoiseSuppressionManager();

