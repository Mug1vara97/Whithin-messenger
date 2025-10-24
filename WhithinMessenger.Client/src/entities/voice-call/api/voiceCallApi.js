import { io } from 'socket.io-client';
import { Device } from 'mediasoup-client';

// Конфигурация для голосового сервера
const VOICE_SERVER_URL = import.meta.env.VITE_VOICE_SERVER_URL || 'https://whithin.ru';
const VOICE_SERVER_CONFIG = {
  transports: ['websocket'],
  upgrade: false,
  rememberUpgrade: false
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

    // Регистрируем базовые обработчики сразу
    this.socket.on('disconnect', () => {
      console.log('Disconnected from voice server');
      this.isConnected = false;
    });

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
    }
    this.isConnected = false;
    this.device = null;
    this.roomId = null;
  }

  async initializeDevice(routerRtpCapabilities) {
    try {
      if (!this.device) {
        this.device = new Device();
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

  async createWebRtcTransport() {
    return new Promise((resolve, reject) => {
      this.socket.emit('createWebRtcTransport', {}, (response) => {
        if (response && response.error) {
          reject(new Error(response.error));
        } else {
          resolve(response);
        }
      });
    });
  }

  async connectTransport(transportId, dtlsParameters) {
    return new Promise((resolve, reject) => {
      this.socket.emit('connectTransport', {
        transportId,
        dtlsParameters
      }, (response) => {
        if (response && response.error) {
          reject(new Error(response.error));
        } else {
          resolve(response);
        }
      });
    });
  }

  async produce(transportId, kind, rtpParameters, appData) {
    return new Promise((resolve, reject) => {
      this.socket.emit('produce', {
        transportId,
        kind,
        rtpParameters,
        appData
      }, (response) => {
        if (response && response.error) {
          reject(new Error(response.error));
        } else {
          resolve(response);
        }
      });
    });
  }

  async consume(rtpCapabilities, remoteProducerId, transportId) {
    return new Promise((resolve, reject) => {
      this.socket.emit('consume', {
        rtpCapabilities,
        remoteProducerId,
        transportId
      }, (response) => {
        if (response && response.error) {
          reject(new Error(response.error));
        } else {
          resolve(response);
        }
      });
    });
  }

  async resumeConsumer(consumerId) {
    return new Promise((resolve, reject) => {
      this.socket.emit('resumeConsumer', {
        consumerId
      }, (response) => {
        if (response && response.error) {
          reject(new Error(response.error));
        } else {
          resolve(response);
        }
      });
    });
  }

  async joinRoom(roomId, name, userId, initialMuted = false, initialAudioEnabled = true) {
    return new Promise((resolve, reject) => {
      this.socket.emit('join', {
        roomId,
        name,
        userId,
        initialMuted,
        initialAudioEnabled
      }, (response) => {
        if (response && response.error) {
          reject(new Error(response.error));
        } else {
          this.roomId = roomId;
          resolve(response);
        }
      });
    });
  }

  on(event, callback) {
    if (this.socket) {
      this.socket.on(event, callback);
    }
  }

  off(event, callback) {
    if (this.socket) {
      this.socket.off(event, callback);
    }
  }

  // Метод для остановки демонстрации экрана
  async stopScreenSharing(producerId) {
    return new Promise((resolve, reject) => {
      // Добавляем таймаут на случай, если сервер не отвечает
      const timeout = setTimeout(() => {
        resolve({ success: true }); // Разрешаем промис, чтобы не блокировать UI
      }, 100); // 1 секунда таймаут
      
      this.socket.emit('stopScreenSharing', {
        producerId
      }, (response) => {
        clearTimeout(timeout);
        if (response && response.error) {
          reject(new Error(response.error));
        } else {
          resolve(response);
        }
      });
    });
  }

  // Метод для остановки вебкамеры
  async stopVideo(producerId) {
    return new Promise((resolve, reject) => {
      // Добавляем таймаут на случай, если сервер не отвечает
      const timeout = setTimeout(() => {
        resolve({ success: true }); // Разрешаем промис, чтобы не блокировать UI
      }, 100); // 1 секунда таймаут
      
      this.socket.emit('stopVideo', {
        producerId
      }, (response) => {
        clearTimeout(timeout);
        if (response && response.error) {
          reject(new Error(response.error));
        } else {
          resolve(response);
        }
      });
    });
  }
}

export const voiceCallApi = new VoiceCallApi();