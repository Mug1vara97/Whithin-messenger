/**
 * Менеджер аудио устройств для предотвращения эха при демонстрации экрана
 * 
 * ИДЕЯ: Направить голоса участников на ДРУГОЕ аудио устройство (например, наушники),
 * чтобы getDisplayMedia не захватывал их вместе с системным звуком.
 */

class AudioDeviceManager {
  constructor() {
    this.selectedOutputDeviceId = null; // Устройство для голосов участников
    this.defaultDeviceId = 'default'; // Системное устройство по умолчанию
  }

  /**
   * Получить список доступных аудио выходов
   */
  async getAudioOutputDevices() {
    try {
      // Запрашиваем разрешение на доступ к устройствам
      await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioOutputs = devices.filter(d => d.kind === 'audiooutput');
      
      console.log('📢 Available audio output devices:', audioOutputs);
      return audioOutputs;
    } catch (error) {
      console.error('Failed to enumerate audio devices:', error);
      return [];
    }
  }

  /**
   * Установить устройство вывода для голосов участников
   */
  setParticipantsOutputDevice(deviceId) {
    this.selectedOutputDeviceId = deviceId;
    console.log('🔊 Participants audio output device set to:', deviceId);
  }

  /**
   * Получить выбранное устройство для голосов участников
   */
  getParticipantsOutputDevice() {
    return this.selectedOutputDeviceId || this.defaultDeviceId;
  }

  /**
   * Применить setSinkId к audio элементу
   */
  async applyAudioOutput(audioElement, deviceId = null) {
    try {
      const targetDeviceId = deviceId || this.getParticipantsOutputDevice();
      
      // Проверяем поддержку setSinkId
      if (!audioElement.setSinkId) {
        console.warn('⚠️ setSinkId is not supported in this browser');
        return false;
      }

      await audioElement.setSinkId(targetDeviceId);
      console.log('✅ Audio output set to device:', targetDeviceId);
      return true;
    } catch (error) {
      console.error('❌ Failed to set audio output device:', error);
      return false;
    }
  }

  /**
   * Проверить, поддерживается ли setSinkId
   */
  isSinkIdSupported() {
    const audio = document.createElement('audio');
    return typeof audio.setSinkId === 'function';
  }

  /**
   * Автоматически выбрать наушники (если доступны)
   */
  async autoSelectHeadphones() {
    const devices = await this.getAudioOutputDevices();
    
    // Ищем устройство с "headphones" или "headset" в названии
    const headphones = devices.find(d => 
      d.label.toLowerCase().includes('headphones') ||
      d.label.toLowerCase().includes('headset') ||
      d.label.toLowerCase().includes('наушник')
    );

    if (headphones) {
      this.setParticipantsOutputDevice(headphones.deviceId);
      console.log('🎧 Auto-selected headphones:', headphones.label);
      return headphones;
    }

    console.log('ℹ️ No headphones found, using default output');
    return null;
  }

  /**
   * Получить информацию о текущем устройстве
   */
  async getCurrentDeviceInfo() {
    const devices = await this.getAudioOutputDevices();
    const currentDeviceId = this.getParticipantsOutputDevice();
    
    const device = devices.find(d => d.deviceId === currentDeviceId);
    return device || { deviceId: 'default', label: 'System Default' };
  }

  /**
   * Проверить, используются ли разные устройства для участников и системы
   */
  isUsingSeparateDevices() {
    return this.selectedOutputDeviceId !== null && 
           this.selectedOutputDeviceId !== 'default';
  }
}

// Singleton instance
let audioDeviceManagerInstance = null;

export const getAudioDeviceManager = () => {
  if (!audioDeviceManagerInstance) {
    audioDeviceManagerInstance = new AudioDeviceManager();
  }
  return audioDeviceManagerInstance;
};

export default AudioDeviceManager;

