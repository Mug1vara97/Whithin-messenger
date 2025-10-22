import { voiceCallApi } from '../../../entities/voice-call/api/voiceCallApi';
import useVoiceCallStore from '../stores/voiceCallStore';

class VoiceCallManager {
  constructor() {
    this.isInitialized = false;
    this.currentUserId = null;
    this.currentUserName = null;
    this.isConnected = false;
    this.currentRoomId = null;
    this.connectionPromise = null;
  }

  // Инициализация менеджера
  initialize(userId, userName) {
    this.currentUserId = userId;
    this.currentUserName = userName;
    this.isInitialized = true;
    console.log('VoiceCallManager: Initialized for user:', userId);
  }

  // Подключение к голосовому серверу (если еще не подключены)
  async connect() {
    if (!this.isInitialized) {
      throw new Error('VoiceCallManager not initialized');
    }

    if (this.isConnected) {
      console.log('VoiceCallManager: Already connected, skipping');
      return;
    }

    if (this.connectionPromise) {
      console.log('VoiceCallManager: Connection in progress, waiting...');
      return this.connectionPromise;
    }

    this.connectionPromise = this._doConnect();
    try {
      await this.connectionPromise;
    } finally {
      this.connectionPromise = null;
    }
  }

  async _doConnect() {
    try {
      console.log('VoiceCallManager: Connecting to voice server...');
      await voiceCallApi.connect(this.currentUserId, this.currentUserName);
      this.isConnected = true;
      useVoiceCallStore.getState().setVoiceServerConnected(true);
      console.log('VoiceCallManager: Connected to voice server');
    } catch (error) {
      console.error('VoiceCallManager: Failed to connect:', error);
      throw error;
    }
  }

  // Присоединение к комнате
  async joinRoom(roomId) {
    if (!this.isConnected) {
      await this.connect();
    }

    if (this.currentRoomId === roomId) {
      console.log('VoiceCallManager: Already in this room, skipping');
      return;
    }

    try {
      console.log('VoiceCallManager: Joining room:', roomId);
      const response = await voiceCallApi.joinRoom(roomId, this.currentUserName, this.currentUserId);
      this.currentRoomId = roomId;
      useVoiceCallStore.getState().joinCall(roomId);
      console.log('VoiceCallManager: Joined room:', roomId);
      return response;
    } catch (error) {
      console.error('VoiceCallManager: Failed to join room:', error);
      throw error;
    }
  }

  // Выход из комнаты
  async leaveRoom() {
    if (!this.currentRoomId) {
      console.log('VoiceCallManager: Not in any room');
      return;
    }

    try {
      console.log('VoiceCallManager: Leaving room:', this.currentRoomId);
      await voiceCallApi.leaveRoom();
      this.currentRoomId = null;
      useVoiceCallStore.getState().leaveCall();
      console.log('VoiceCallManager: Left room');
    } catch (error) {
      console.error('VoiceCallManager: Failed to leave room:', error);
      throw error;
    }
  }

  // Отключение от сервера
  async disconnect() {
    try {
      console.log('VoiceCallManager: Disconnecting from voice server...');
      await voiceCallApi.disconnect();
      this.isConnected = false;
      this.currentRoomId = null;
      useVoiceCallStore.getState().setVoiceServerConnected(false);
      useVoiceCallStore.getState().leaveCall();
      console.log('VoiceCallManager: Disconnected from voice server');
    } catch (error) {
      console.error('VoiceCallManager: Failed to disconnect:', error);
      throw error;
    }
  }

  // Получение состояния
  getState() {
    return {
      isConnected: this.isConnected,
      currentRoomId: this.currentRoomId,
      isInitialized: this.isInitialized
    };
  }
}

// Создаем глобальный экземпляр
const voiceCallManager = new VoiceCallManager();

export default voiceCallManager;
