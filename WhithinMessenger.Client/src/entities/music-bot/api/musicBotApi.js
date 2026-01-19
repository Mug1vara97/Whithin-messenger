import { io } from 'socket.io-client';

const VOICE_SERVER_URL = import.meta.env.VITE_VOICE_SERVER_URL || 'https://whithin.ru';
const VOICE_SERVER_CONFIG = {
  transports: ['websocket'],
  upgrade: false,
  rememberUpgrade: false
};

class MusicBotApi {
  constructor() {
    this.socket = null;
    this.eventHandlers = new Map();
  }

  connect() {
    if (this.socket?.connected) {
      return this.socket;
    }
    
    this.socket = io(VOICE_SERVER_URL, VOICE_SERVER_CONFIG);
    
    this.socket.on('connect', () => {
      console.log('[MusicBotApi] Connected to voice server');
    });

    this.socket.on('disconnect', () => {
      console.log('[MusicBotApi] Disconnected from voice server');
    });

    this.socket.on('connect_error', (error) => {
      console.error('[MusicBotApi] Connection error:', error);
    });

    // Подписываемся на события бота
    this.socket.on('botMessage', (data) => {
      const handlers = this.eventHandlers.get('botMessage') || [];
      handlers.forEach(handler => handler(data));
    });

    this.socket.on('botJoined', (data) => {
      const handlers = this.eventHandlers.get('botJoined') || [];
      handlers.forEach(handler => handler(data));
    });

    this.socket.on('botLeft', (data) => {
      const handlers = this.eventHandlers.get('botLeft') || [];
      handlers.forEach(handler => handler(data));
    });
    
    return this.socket;
  }

  async addBotToRoom(roomId) {
    const socket = this.connect();
    const roomIdStr = String(roomId || '');
    return new Promise((resolve, reject) => {
      socket.emit('botJoinRoom', { roomId: roomIdStr }, (response) => {
        if (response?.error) {
          reject(new Error(response.error));
        } else {
          resolve(response || { success: true, roomId: roomIdStr });
        }
      });
    });
  }

  async removeBotFromRoom(roomId) {
    const socket = this.connect();
    const roomIdStr = String(roomId || '');
    return new Promise((resolve, reject) => {
      socket.emit('botLeaveRoom', { roomId: roomIdStr }, (response) => {
        if (response?.error) {
          reject(new Error(response.error));
        } else {
          resolve(response || { success: true, roomId: roomIdStr });
        }
      });
    });
  }

  sendCommand(roomId, command, args = []) {
    const socket = this.connect();
    const userId = this.getCurrentUserId();
    // Преобразуем roomId в строку для консистентности
    const roomIdStr = String(roomId || '');
    socket.emit('botCommand', { 
      roomId: roomIdStr, 
      command, 
      args: Array.isArray(args) ? args : [args],
      userId 
    });
  }

  onBotMessage(callback) {
    if (!this.eventHandlers.has('botMessage')) {
      this.eventHandlers.set('botMessage', []);
    }
    this.eventHandlers.get('botMessage').push(callback);
    
    return () => {
      const handlers = this.eventHandlers.get('botMessage') || [];
      const index = handlers.indexOf(callback);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    };
  }

  onBotJoined(callback) {
    if (!this.eventHandlers.has('botJoined')) {
      this.eventHandlers.set('botJoined', []);
    }
    this.eventHandlers.get('botJoined').push(callback);
    
    return () => {
      const handlers = this.eventHandlers.get('botJoined') || [];
      const index = handlers.indexOf(callback);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    };
  }

  onBotLeft(callback) {
    if (!this.eventHandlers.has('botLeft')) {
      this.eventHandlers.set('botLeft', []);
    }
    this.eventHandlers.get('botLeft').push(callback);
    
    return () => {
      const handlers = this.eventHandlers.get('botLeft') || [];
      const index = handlers.indexOf(callback);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    };
  }

  getCurrentUserId() {
    // Попытка получить userId из localStorage или других источников
    try {
      const authData = localStorage.getItem('auth');
      if (authData) {
        const parsed = JSON.parse(authData);
        return parsed.user?.id || parsed.user?.userId;
      }
    } catch (e) {
      console.warn('[MusicBotApi] Could not get userId from localStorage');
    }
    return null;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.eventHandlers.clear();
    }
  }
}

export const musicBotApi = new MusicBotApi();
