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
    this.requestedChannels = new Set(); // Каналы для которых уже запрошены участники
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
      
      // Очищаем requestedChannels при переподключении чтобы запросить заново
      this.requestedChannels.clear();
      
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
      const { channelId, userId, userName, isMuted, isAudioDisabled, avatar, avatarColor } = data;
      
      // Удаляем пользователя из всех других каналов перед добавлением в новый
      const state = useCallStore.getState();
      state.voiceChannelParticipants.forEach((participants, existingChannelId) => {
        if (existingChannelId !== channelId) {
          const hasUser = participants.some(p => 
            (p.odUserId === userId) || (p.userId === userId)
          );
          if (hasUser) {
            console.log(`[VoiceChannelService] Removing user ${userId} from channel ${existingChannelId} before adding to ${channelId}`);
            state.removeVoiceChannelParticipant(existingChannelId, userId);
          }
        }
      });
      
      useCallStore.getState().addVoiceChannelParticipant(channelId, {
        odUserId: userId,
        userName,
        isMuted: isMuted || false,
        isAudioDisabled: isAudioDisabled || false,
        isDeafened: isAudioDisabled || false,
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
        isAudioDisabled: p.isAudioDisabled || false,
        isDeafened: p.isAudioDisabled || false,
        avatar: p.avatar || null,
        avatarColor: p.avatarColor || '#5865f2'
      }));
      
      // Удаляем всех пользователей из этого канала из других каналов
      const state = useCallStore.getState();
      formattedParticipants.forEach(participant => {
        const userId = participant.odUserId;
        state.voiceChannelParticipants.forEach((existingParticipants, existingChannelId) => {
          if (existingChannelId !== channelId) {
            const hasUser = existingParticipants.some(p => 
              (p.odUserId === userId) || (p.userId === userId)
            );
            if (hasUser) {
              console.log(`[VoiceChannelService] Removing user ${userId} from channel ${existingChannelId} (now in ${channelId})`);
              state.removeVoiceChannelParticipant(existingChannelId, userId);
            }
          }
        });
      });
      
      // Проверяем, изменились ли данные перед обновлением
      const currentParticipants = state.voiceChannelParticipants?.get?.(channelId) || [];
      const hasChanged = formattedParticipants.length !== currentParticipants.length ||
        formattedParticipants.some((p, i) => {
          const curr = currentParticipants[i];
          return !curr || p.odUserId !== curr.odUserId || p.isMuted !== curr.isMuted || 
                 p.isSpeaking !== curr.isSpeaking || p.isAudioDisabled !== curr.isAudioDisabled;
        });
      
      if (hasChanged) {
        state.setVoiceChannelParticipants(channelId, formattedParticipants);
      }
    });

    this.socket.on('voiceChannelParticipantStateChanged', (data) => {
      console.log('[VoiceChannelService] Voice channel participant state changed:', data);
      const { channelId, userId: odUserId, isMuted, isSpeaking, isAudioDisabled } = data;
      
      useCallStore.getState().updateVoiceChannelParticipant(channelId, odUserId, {
        isMuted,
        isSpeaking,
        isAudioDisabled,
        isDeafened: isAudioDisabled
      });
    });

    // Обработка глобального изменения состояния наушников
    this.socket.on('globalAudioState', (data) => {
      console.log('[VoiceChannelService] Global audio state changed:', data);
      const { userId, isGlobalAudioMuted } = data;
      
      // Находим все каналы, где находится этот пользователь
      const state = useCallStore.getState();
      state.voiceChannelParticipants.forEach((participants, channelId) => {
        const participant = participants.find(p => 
          (p.odUserId === userId) || (p.userId === userId)
        );
        if (participant) {
          useCallStore.getState().updateVoiceChannelParticipant(channelId, userId, {
            isGlobalAudioMuted,
            isAudioDisabled: isGlobalAudioMuted,
            isDeafened: isGlobalAudioMuted
          });
        }
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
      this.requestedChannels.clear();
    }
  }

  // Подписаться на обновления канала
  subscribeToChannel(channelId) {
    if (!channelId) return;
    
    // Уже подписаны на этот канал
    if (this.subscribedChannels.has(channelId)) {
      return;
    }
    
    this.subscribedChannels.add(channelId);
    
    // Запрашиваем участников только если ещё не запрашивали
    if (this.isConnected && !this.requestedChannels.has(channelId)) {
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

    // Не запрашиваем повторно
    if (this.requestedChannels.has(channelId)) {
      return;
    }

    console.log('[VoiceChannelService] Requesting participants for channel:', channelId);
    this.requestedChannels.add(channelId);
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
