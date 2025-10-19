import { io } from 'socket.io-client';
import { VOICE_SERVER_URL, VOICE_SERVER_CONFIG } from '../../../shared/lib/constants/apiEndpoints';

// Ленивый импорт mediasoup-client
let Device = null;
const getDevice = async () => {
  if (!Device) {
    const { Device: MediasoupDevice } = await import('mediasoup-client');
    Device = MediasoupDevice;
  }
  return Device;
};

class VoiceCallApi {
  constructor() {
    this.socket = null;
    this.device = null;
    this.isConnected = false;
    this.roomId = null;
    this.userId = null;
    this.userName = null;
  }

  async connect(userId, userName, serverUrl = VOICE_SERVER_URL) {
    if (this.socket && this.isConnected) {
      return this.socket;
    }

    this.userId = userId;
    this.userName = userName;

    this.socket = io(serverUrl, VOICE_SERVER_CONFIG);

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, 10000);

      this.socket.on('connect', () => {
        clearTimeout(timeout);
        this.isConnected = true;
        console.log('Voice call connection established');
        resolve(this.socket);
      });

      this.socket.on('connect_error', (error) => {
        clearTimeout(timeout);
        console.error('Failed to connect to voice server:', error);
        reject(error);
      });
    });
  }

  async disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      this.roomId = null;
    }
  }

  // Инициализация медиа-устройства
  async initializeDevice(routerRtpCapabilities) {
    try {
      if (!this.device) {
        const DeviceClass = await getDevice();
        this.device = new DeviceClass();
      }

      if (!this.device.loaded) {
        await this.device.load({ routerRtpCapabilities });
      }

      return this.device;
    } catch (error) {
      console.error('Failed to initialize device:', error);
      throw error;
    }
  }

  // Создание комнаты
  async createRoom(roomId) {
    if (!this.socket || !this.isConnected) {
      throw new Error('Voice connection not established');
    }

    return new Promise((resolve, reject) => {
      this.socket.emit('createRoom', { roomId }, (response) => {
        if (response.error) {
          reject(new Error(response.error));
        } else {
          this.roomId = roomId;
          resolve(response);
        }
      });
    });
  }

  // Присоединение к комнате
  async joinRoom(roomId, name, initialMuted = false, initialAudioEnabled = true) {
    if (!this.socket || !this.isConnected) {
      throw new Error('Voice connection not established');
    }

    return new Promise((resolve, reject) => {
      this.socket.emit('join', {
        roomId,
        name: name || this.userName,
        userId: this.userId,
        initialMuted,
        initialAudioEnabled
      }, (response) => {
        if (response.error) {
          reject(new Error(response.error));
        } else {
          this.roomId = roomId;
          resolve(response);
        }
      });
    });
  }

  // Создание WebRTC транспорта
  async createWebRtcTransport() {
    if (!this.socket || !this.isConnected) {
      throw new Error('Voice connection not established');
    }

    return new Promise((resolve, reject) => {
      this.socket.emit('createWebRtcTransport', (response) => {
        if (response.error) {
          reject(new Error(response.error));
        } else {
          resolve(response);
        }
      });
    });
  }

  // Подключение транспорта
  async connectTransport(transportId, dtlsParameters) {
    if (!this.socket || !this.isConnected) {
      throw new Error('Voice connection not established');
    }

    return new Promise((resolve, reject) => {
      this.socket.emit('connectTransport', { transportId, dtlsParameters }, (response) => {
        if (response.error) {
          reject(new Error(response.error));
        } else {
          resolve(response);
        }
      });
    });
  }

  // Создание producer (аудио/видео)
  async produce(transportId, kind, rtpParameters, appData = {}) {
    if (!this.socket || !this.isConnected) {
      throw new Error('Voice connection not established');
    }

    return new Promise((resolve, reject) => {
      this.socket.emit('produce', {
        transportId,
        kind,
        rtpParameters,
        appData: {
          ...appData,
          userId: this.userId
        }
      }, (response) => {
        if (response.error) {
          reject(new Error(response.error));
        } else {
          resolve(response);
        }
      });
    });
  }

  // Создание consumer
  async consume(rtpCapabilities, remoteProducerId, transportId) {
    if (!this.socket || !this.isConnected) {
      throw new Error('Voice connection not established');
    }

    return new Promise((resolve, reject) => {
      this.socket.emit('consume', {
        rtpCapabilities,
        remoteProducerId,
        transportId
      }, (response) => {
        if (response.error) {
          reject(new Error(response.error));
        } else {
          resolve(response);
        }
      });
    });
  }

  // Возобновление consumer
  async resumeConsumer(consumerId) {
    if (!this.socket || !this.isConnected) {
      throw new Error('Voice connection not established');
    }

    return new Promise((resolve, reject) => {
      this.socket.emit('resumeConsumer', { consumerId }, (response) => {
        if (response.error) {
          reject(new Error(response.error));
        } else {
          resolve(response);
        }
      });
    });
  }

  // Изменение состояния микрофона
  async toggleMute(isMuted) {
    if (!this.socket || !this.isConnected) {
      throw new Error('Voice connection not established');
    }

    this.socket.emit('muteState', { isMuted });
  }

  // Изменение состояния аудио
  async toggleAudio(isEnabled) {
    if (!this.socket || !this.isConnected) {
      throw new Error('Voice connection not established');
    }

    this.socket.emit('audioState', { isEnabled });
  }

  // Отправка состояния говорения
  async setSpeaking(speaking) {
    if (!this.socket || !this.isConnected) {
      throw new Error('Voice connection not established');
    }

    this.socket.emit('speaking', { speaking });
  }

  // Остановка демонстрации экрана
  async stopScreenShare(producerId) {
    if (!this.socket || !this.isConnected) {
      throw new Error('Voice connection not established');
    }

    this.socket.emit('stopScreenSharing', { producerId });
  }

  // Получение участников комнаты
  async getPeers() {
    if (!this.socket || !this.isConnected) {
      throw new Error('Voice connection not established');
    }

    return new Promise((resolve, reject) => {
      this.socket.emit('getPeers', (response) => {
        if (response.error) {
          reject(new Error(response.error));
        } else {
          resolve(response);
        }
      });
    });
  }

  // Получение участников голосового канала
  async getVoiceChannelParticipants() {
    if (!this.socket || !this.isConnected) {
      throw new Error('Voice connection not established');
    }

    this.socket.emit('getVoiceChannelParticipants');
  }

  // Обновление состояния пользователя в голосовом канале
  async updateUserVoiceState(userId, userName, channelId, isMuted, isAudioDisabled) {
    if (!this.socket || !this.isConnected) {
      throw new Error('Voice connection not established');
    }

    this.socket.emit('updateUserVoiceState', {
      userId,
      userName,
      channelId,
      isMuted,
      isAudioDisabled
    });
  }
}

export const voiceCallApi = new VoiceCallApi();
