import { io } from 'socket.io-client';
import { useCallStore } from '../stores/callStore';
import { voiceCallApi } from '../../../entities/voice-call/api/voiceCallApi';

const VOICE_SERVER_URL = import.meta.env.VITE_VOICE_SERVER_URL || 'https://whithin.ru';

const normalizeChannelId = (channelId) => (channelId == null ? '' : String(channelId));

const resolveParticipantUserId = (participant) =>
  participant?.odUserId ?? participant?.userId ?? participant?.id ?? null;

const participantsListChanged = (next = [], prev = []) => {
  if (next.length !== prev.length) return true;
  const prevById = new Map(
    prev.map((participant) => [String(resolveParticipantUserId(participant)), participant])
  );
  return next.some((participant) => {
    const id = String(resolveParticipantUserId(participant));
    const current = prevById.get(id);
    if (!current) return true;
    return (
      (participant.userName || participant.name) !== (current.userName || current.name) ||
      Boolean(participant.isMuted) !== Boolean(current.isMuted) ||
      Boolean(participant.isSpeaking) !== Boolean(current.isSpeaking) ||
      Boolean(participant.isAudioDisabled) !== Boolean(current.isAudioDisabled)
    );
  });
};

class VoiceChannelService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.subscribedChannels = new Set();
    this.requestedChannels = new Map();
    this.refreshTimer = null;
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
      reconnectionDelayMax: 5000,
    });

    this.socket.on('connect', () => {
      console.log('[VoiceChannelService] Connected to voice server');
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.requestedChannels.clear();
      this.subscribedChannels.forEach((channelId) => {
        this.requestChannelParticipants(channelId, true);
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

    this.socket.on('userJoinedVoiceChannel', (data) => {
      console.log('[VoiceChannelService] User joined voice channel:', data);
      const channelId = normalizeChannelId(data.channelId);
      const { userId, userName, isMuted, isAudioDisabled, avatar, avatarColor } = data;

      const state = useCallStore.getState();
      state.voiceChannelParticipants.forEach((participants, existingChannelId) => {
        if (normalizeChannelId(existingChannelId) !== channelId) {
          const hasUser = participants.some(
            (p) => String(resolveParticipantUserId(p)) === String(userId)
          );
          if (hasUser) {
            state.removeVoiceChannelParticipant(existingChannelId, userId);
          }
        }
      });

      useCallStore.getState().addVoiceChannelParticipant(channelId, {
        odUserId: userId,
        userId,
        userName,
        isMuted: isMuted || false,
        isAudioDisabled: isAudioDisabled || false,
        isDeafened: isAudioDisabled || false,
        avatar: avatar || null,
        avatarColor: avatarColor || '#5865f2',
      });
    });

    this.socket.on('userLeftVoiceChannel', (data) => {
      console.log('[VoiceChannelService] User left voice channel:', data);
      const channelId = normalizeChannelId(data.channelId);
      const userId = data.userId;
      useCallStore.getState().removeVoiceChannelParticipant(channelId, userId);
    });

    this.socket.on('voiceChannelParticipantsUpdate', (data) => {
      console.log('[VoiceChannelService] Voice channel participants update:', data);
      const channelId = normalizeChannelId(data.channelId);
      const formattedParticipants = (data.participants || []).map((p) => ({
        odUserId: p.userId,
        userId: p.userId,
        userName: p.name || p.userName,
        isMuted: p.isMuted || false,
        isSpeaking: p.isSpeaking || false,
        isAudioDisabled: p.isAudioDisabled || false,
        isDeafened: p.isAudioDisabled || false,
        avatar: p.avatar || null,
        avatarColor: p.avatarColor || '#5865f2',
      }));

      const state = useCallStore.getState();
      formattedParticipants.forEach((participant) => {
        const userId = resolveParticipantUserId(participant);
        state.voiceChannelParticipants.forEach((existingParticipants, existingChannelId) => {
          if (normalizeChannelId(existingChannelId) !== channelId) {
            const hasUser = existingParticipants.some(
              (p) => String(resolveParticipantUserId(p)) === String(userId)
            );
            if (hasUser) {
              state.removeVoiceChannelParticipant(existingChannelId, userId);
            }
          }
        });
      });

      const isActiveCallChannel =
        state.isInCall &&
        normalizeChannelId(state.currentRoomId) === channelId;
      const liveKitRemoteCount = voiceCallApi?.room?.remoteParticipants?.size || 0;
      const liveKitRoomMatches =
        normalizeChannelId(voiceCallApi?.roomId) === channelId;

      if (
        isActiveCallChannel &&
        formattedParticipants.length === 0 &&
        liveKitRoomMatches &&
        (liveKitRemoteCount > 0 || state.participants.length > 0)
      ) {
        console.warn(
          '[VoiceChannelService] Ignoring empty participant update for active call channel:',
          channelId
        );
        return;
      }

      const currentParticipants = state.voiceChannelParticipants?.get?.(channelId) || [];
      if (participantsListChanged(formattedParticipants, currentParticipants)) {
        state.setVoiceChannelParticipants(channelId, formattedParticipants);
      }
    });

    this.socket.on('voiceChannelParticipantStateChanged', (data) => {
      console.log('[VoiceChannelService] Voice channel participant state changed:', data);
      const channelId = normalizeChannelId(data.channelId);
      const userId = data.userId;
      const { isMuted, isSpeaking, isAudioDisabled } = data;

      useCallStore.getState().updateVoiceChannelParticipant(channelId, userId, {
        isMuted,
        isSpeaking,
        isAudioDisabled,
        isDeafened: isAudioDisabled,
      });
    });

    this.socket.on('globalAudioState', (data) => {
      console.log('[VoiceChannelService] Global audio state changed:', data);
      const { userId, isGlobalAudioMuted } = data;
      const state = useCallStore.getState();

      state.voiceChannelParticipants.forEach((participants, channelId) => {
        const participant = participants.find(
          (p) => String(resolveParticipantUserId(p)) === String(userId)
        );
        if (participant) {
          useCallStore.getState().updateVoiceChannelParticipant(channelId, userId, {
            isGlobalAudioMuted,
            isAudioDisabled: isGlobalAudioMuted,
            isDeafened: isGlobalAudioMuted,
          });
        }
      });
    });

    if (!this.refreshTimer) {
      this.refreshTimer = window.setInterval(() => {
        if (!this.isConnected) return;
        this.subscribedChannels.forEach((channelId) => {
          this.requestChannelParticipants(channelId, true);
        });
      }, 20000);
    }
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
    if (this.refreshTimer) {
      window.clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  subscribeToChannel(channelId) {
    const key = normalizeChannelId(channelId);
    if (!key) return;

    this.subscribedChannels.add(key);

    if (this.isConnected) {
      this.requestChannelParticipants(key);
    }
  }

  unsubscribeFromChannel(channelId) {
    this.subscribedChannels.delete(normalizeChannelId(channelId));
  }

  requestChannelParticipants(channelId, force = false) {
    const key = normalizeChannelId(channelId);
    if (!this.socket || !this.isConnected || !key) {
      console.warn('[VoiceChannelService] Cannot request participants - not connected');
      return;
    }

    const lastRequestedAt = this.requestedChannels.get(key) || 0;
    const now = Date.now();
    if (!force && now - lastRequestedAt < 3000) {
      return;
    }

    console.log('[VoiceChannelService] Requesting participants for channel:', key);
    this.requestedChannels.set(key, now);
    this.socket.emit('getVoiceChannelParticipants', { channelId: key });
  }

  requestMultipleChannelParticipants(channelIds) {
    if (!Array.isArray(channelIds)) return;
    channelIds.forEach((channelId) => {
      this.subscribeToChannel(channelId);
    });
  }

  switchUserToChannel(userId, targetChannelId) {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.isConnected) {
        reject(new Error('Not connected to voice server'));
        return;
      }
      if (!userId || !targetChannelId) {
        reject(new Error('userId and targetChannelId are required'));
        return;
      }

      this.socket.emit('switchUserToChannel', { userId, targetChannelId }, (response) => {
        if (response && response.error) {
          reject(new Error(response.error));
          return;
        }
        resolve(response || { success: true });
      });
    });
  }
}

export const voiceChannelService = new VoiceChannelService();
export default voiceChannelService;
