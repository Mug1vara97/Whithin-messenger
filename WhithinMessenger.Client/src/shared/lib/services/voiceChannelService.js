import { io } from 'socket.io-client';
import { useCallStore } from '../stores/callStore';

const VOICE_SERVER_URL = import.meta.env.VITE_VOICE_SERVER_URL || 'https://whithin.ru';

class VoiceChannelService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.subscribedChannels = new Set();
  }

  connect() {
    if (this.socket && this.isConnected) {
      console.log('[VoiceChannelService] Already connected');
      return;
    }

    console.log('[VoiceChannelService] Connecting to voice server for channel updates...');
    
    this.socket = io(VOICE_SERVER_URL, {
      transports: ['websocket'],
      upgrade: false,
      rememberUpgrade: false,
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000
    });

    this.socket.on('connect', () => {
      console.log('[VoiceChannelService] Connected to voice server');
      this.isConnected = true;
      this.reconnectAttempts = 0;
      
      // Запрашиваем участников для всех подписанных каналов
      this.subscribedChannels.forEach(channelId => {
        this.requestChannelParticipants(channelId);
      });
    });

    this.socket.on('disconnect', () => {
      console.log('[VoiceChannelService] Disconnected from voice server');
      this.isConnected = false;
    });

    this.socket.on('connect_error', (error) => {
      console.warn('[VoiceChannelService] Connection error:', error.message);
      this.reconnectAttempts++;
    });

    // Подписываемся на события обновления участников
    this.socket.on('userJoinedVoiceChannel', (data) => {
      console.log('[VoiceChannelService] User joined voice channel:', data);
      const { channelId, userId, userName, isMuted, avatar, avatarColor } = data;
      
      useCallStore.getState().addVoiceChannelParticipant(channelId, {
        odUserId: userId,
        userName,
        isMuted: isMuted || false,
        avatar: avatar || null,
        avatarColor: avatarColor || '#5865f2'
      });
    });

    this.socket.on('userLeftVoiceChannel', (data) => {
      console.log('[VoiceChannelService] User left voice channel:', data);
      const { channelId, userId: odUserId } = data;
      
      useCallStore.getState().removeVoiceChannelParticipant(channelId, odUserId);
    });

    this.socket.on('voiceChannelParticipantsUpdate', (data) => {
      console.log('[VoiceChannelService] Voice channel participants update:', data);
      const { channelId, participants } = data;
      
      const formattedParticipants = (participants || []).map(p => ({
        odUserId: p.userId,
        userName: p.name || p.userName,
        isMuted: p.isMuted || false,
        isSpeaking: p.isSpeaking || false,
        avatar: p.avatar || null,
        avatarColor: p.avatarColor || '#5865f2'
      }));
      
      useCallStore.getState().setVoiceChannelParticipants(channelId, formattedParticipants);
    });

    this.socket.on('voiceChannelParticipantStateChanged', (data) => {
      console.log('[VoiceChannelService] Voice channel participant state changed:', data);
      const { channelId, userId: odUserId, isMuted, isSpeaking } = data;
      
      useCallStore.getState().updateVoiceChannelParticipant(channelId, odUserId, {
        isMuted,
        isSpeaking
      });
    });
  }

  disconnect() {
    if (this.socket) {
      console.log('[VoiceChannelService] Disconnecting...');
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      this.subscribedChannels.clear();
    }
  }

  // Подписаться на обновления канала
  subscribeToChannel(channelId) {
    if (!channelId) return;
    
    this.subscribedChannels.add(channelId);
    
    if (this.isConnected) {
      this.requestChannelParticipants(channelId);
    }
  }

  // Отписаться от обновлений канала
  unsubscribeFromChannel(channelId) {
    this.subscribedChannels.delete(channelId);
  }

  // Запросить участников канала
  requestChannelParticipants(channelId) {
    if (!this.socket || !this.isConnected) {
      console.warn('[VoiceChannelService] Cannot request participants - not connected');
      return;
    }

    console.log('[VoiceChannelService] Requesting participants for channel:', channelId);
    this.socket.emit('getVoiceChannelParticipants', { channelId });
  }

  // Запросить участников для нескольких каналов
  requestMultipleChannelParticipants(channelIds) {
    if (!Array.isArray(channelIds)) return;
    
    channelIds.forEach(channelId => {
      this.subscribeToChannel(channelId);
    });
  }
}

export const voiceChannelService = new VoiceChannelService();
export default voiceChannelService;
