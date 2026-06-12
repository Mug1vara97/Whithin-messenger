import { io } from 'socket.io-client';
import { Room, RoomEvent, Track, TrackPublication, VideoPresets } from 'livekit-client';

// Конфигурация для голосового сервера
const VOICE_SERVER_URL = import.meta.env.VITE_VOICE_SERVER_URL || 'https://whithin.ru';
const VOICE_SERVER_CONFIG = {
  transports: ['websocket'],
  upgrade: false,
  rememberUpgrade: false,
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
};

// ICE серверы для WebRTC
const ICE_SERVERS = [
  { urls: ['stun:185.119.59.23:3478'] },
  { urls: ['stun:stun.l.google.com:19302'] },
  { urls: ['stun:stun1.l.google.com:19302'] },
  {
    urls: ['turn:185.119.59.23:3478?transport=udp'],
    username: 'test',
    credential: 'test123'
  },
  {
    urls: ['turn:185.119.59.23:3478?transport=tcp'],
    username: 'test',
    credential: 'test123'
  }
];

// Конфигурация LiveKit Room
const getRoomOptions = () => {
  return {
    rtcConfig: {
      iceServers: ICE_SERVERS,
      iceTransportPolicy: 'all',
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require'
    },
    adaptiveStream: true,
    dynacast: true,
    // Do not hard-pin audio capture format (sampleRate/channelCount).
    // When screen-share audio is enabled, browser/Electron may provide
    // a different Opus fmtp profile than microphone. Forcing mono here
    // can lead to SDP bundle codec collisions for multiple audio tracks.
    audioCaptureDefaults: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true
    },
    videoCaptureDefaults: {
      resolution: VideoPresets.h1080.resolution,
      frameRate: 30
    },
    publishDefaults: {
      videoCodec: 'vp8',
      videoEncoding: VideoPresets.h1080.encoding,
      simulcast: true,
      videoSimulcastLayers: [VideoPresets.h360, VideoPresets.h720]
    }
  };
};

/**
 * Явно отключает локальный захват LiveKit до disconnect.
 * Иначе в Electron/Chromium индикатор «микрофон в использовании» в ОС
 * может оставаться активным после выхода из звонка.
 */
async function releaseLiveKitLocalCapture(room) {
  if (!room?.localParticipant) return;
  const lp = room.localParticipant;
  try {
    await lp.setMicrophoneEnabled(false);
  } catch (e) {
    console.warn('releaseLiveKitLocalCapture: setMicrophoneEnabled(false)', e);
  }
  try {
    await lp.setCameraEnabled(false);
  } catch (e) {
    console.warn('releaseLiveKitLocalCapture: setCameraEnabled(false)', e);
  }
  try {
    if (typeof lp.setScreenShareEnabled === 'function') {
      await lp.setScreenShareEnabled(false);
    }
  } catch (e) {
    console.warn('releaseLiveKitLocalCapture: setScreenShareEnabled(false)', e);
  }
}

class VoiceCallApi {
  constructor() {
    this.socket = null;
    this.room = null;
    this.isConnected = false;
    this.roomId = null;
    this.userId = null;
    this.userName = null;
    this.eventHandlers = new Map();
    this.hadSocketSession = false;
    this.suppressReconnectEvent = false;
  }

  getPublicationMediaType(publication) {
    const trackName = publication?.trackName || publication?.name;
    if (trackName === 'soundpad') return 'soundpad';

    const source = publication?.source;
    if (source === Track.Source.ScreenShare) return 'screen';
    if (source === Track.Source.Camera) return 'camera';
    if (source === Track.Source.ScreenShareAudio) return 'screen';
    return 'microphone';
  }

  async waitForScreenShareCleared(timeoutMs = 3000) {
    if (!this.room) return;

    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      const hasScreenShareVideoPublication = Array.from(
        this.room.localParticipant.videoTrackPublications.values()
      ).some((publication) => publication.source === Track.Source.ScreenShare);

      const hasScreenShareAudioPublication = Array.from(
        this.room.localParticipant.audioTrackPublications.values()
      ).some((publication) => publication.source === Track.Source.ScreenShareAudio);

      if (!hasScreenShareVideoPublication && !hasScreenShareAudioPublication) {
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }

  hasLocalScreenShareAudioPublication() {
    if (!this.room) return false;
    return Array.from(
      this.room.localParticipant.audioTrackPublications.values()
    ).some((publication) => {
      const isScreenAudio = publication.source === Track.Source.ScreenShareAudio;
      const trackReady = publication.track?.mediaStreamTrack?.readyState !== 'ended';
      return isScreenAudio && trackReady;
    });
  }

  async waitForScreenShareAudioPublished(timeoutMs = 2200) {
    if (!this.room) return false;

    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      if (this.hasLocalScreenShareAudioPublication()) {
        return true;
      }
      await new Promise((resolve) => setTimeout(resolve, 60));
    }

    return this.hasLocalScreenShareAudioPublication();
  }

  tuneLocalScreenShareAudioTrack() {
    if (!this.room) return;
    try {
      for (const publication of this.room.localParticipant.audioTrackPublications.values()) {
        if (publication.source !== Track.Source.ScreenShareAudio) continue;
        const mediaTrack = publication.track?.mediaStreamTrack;
        if (!mediaTrack) continue;

        // For screen-share audio we want transparent transport of program sound,
        // not voice-oriented post-processing.
        if ('contentHint' in mediaTrack) {
          mediaTrack.contentHint = 'music';
        }
      }
    } catch (error) {
      console.warn('Failed to tune screen-share audio track:', error);
    }
  }

  async connect(userId, userName, serverUrl = VOICE_SERVER_URL) {
    if (this.socket && this.isConnected) {
      return this.socket;
    }

    this.userId = userId;
    this.userName = userName;

    this.socket = io(serverUrl, VOICE_SERVER_CONFIG);

    // Регистрируем базовые обработчики сразу
    this.socket.on('disconnect', (reason) => {
      console.log('Disconnected from voice server:', reason);
      this.isConnected = false;
      this.emit('voiceServerDisconnected', { reason });
    });

    this.socket.on('connect', () => {
      this.isConnected = true;
      if (this.suppressReconnectEvent) {
        this.suppressReconnectEvent = false;
        this.hadSocketSession = false;
        return;
      }
      if (this.hadSocketSession) {
        this.emit('voiceServerReconnected');
      }
      this.hadSocketSession = true;
    });

    this.socket.on('peerJoined', (data) => {
      this.emit('peerJoined', {
        ...data,
        peerId: data.peerId || data.id,
        userId: data.userId,
      });
    });

    this.socket.on('peerLeft', (data) => {
      this.emit('peerLeft', {
        ...data,
        peerId: data.peerId || data.id,
        userId: data.userId,
      });
    });

    this.socket.on('serverVoiceModerationApplied', (data) => {
      this.emit('serverVoiceModerationApplied', data);
    });

    this.socket.on('peerMuteStateChanged', (data) => {
      this.emit('peerMuteStateChanged', {
        peerId: data.peerId,
        userId: data.userId,
        isMuted: data.isMuted,
      });
    });

    this.socket.on('peerAudioStateChanged', (data) => {
      this.emit('peerAudioStateChanged', data);
    });

    // Обработчик переключения в другой канал (от сервера)
    this.socket.on('switchToChannel', async ({
      channelId,
      sourceChannelId,
      channelName: eventChannelName,
      categoryId,
      categoryName,
      categoryOrder,
      chatOrder,
    }) => {
      console.log('switchToChannel: Received switch command to channel', channelId, 'from', sourceChannelId);
      
      // Если мы находимся в исходном канале, переключаемся
      if (this.roomId === sourceChannelId && this.room) {
        try {
          // Используем callStore для правильного переключения
          const { useCallStore } = await import('../../../shared/lib/stores/callStore');
          const callStore = useCallStore.getState();
          
          let channelName = eventChannelName || null;
          
          if (!channelName) {
            try {
              const { serverApi } = await import('../../server/api/serverApi');
              const serverId = window.location.pathname.match(/\/server\/([^/]+)/)?.[1];
              
              if (serverId) {
                try {
                  const serverData = await serverApi.getServerById(serverId);
                  const allChannels = serverData.categories?.flatMap(cat => cat.chats || cat.Chats || []) || [];
                  const foundChannel = allChannels.find(chat => 
                    (chat.chatId || chat.ChatId || chat.chat_id) === channelId
                  );
                  if (foundChannel) {
                    channelName = foundChannel.name || foundChannel.Name || foundChannel.groupName;
                  }
                } catch (apiErr) {
                  console.warn('switchToChannel: Failed to get channel name from API:', apiErr);
                }
              }
              
              if (!channelName && window.__serverData__) {
                const serverData = window.__serverData__;
                const allChannels = serverData.categories?.flatMap(cat => cat.chats || cat.Chats || []) || [];
                const foundChannel = allChannels.find(chat => 
                  (chat.chatId || chat.ChatId || chat.chat_id) === channelId
                );
                if (foundChannel) {
                  channelName = foundChannel.name || foundChannel.Name || foundChannel.groupName;
                }
              }
            } catch (err) {
              console.warn('switchToChannel: Failed to get channel name:', err);
            }
          }
          
          if (!channelName) {
            channelName = callStore.currentCall?.channelName || channelId;
            console.warn('switchToChannel: Could not find channel name, using fallback:', channelName);
          }
          
          const serverId =
            callStore.currentCallServerId ||
            window.location.pathname.match(/\/server\/([^/]+)/)?.[1] ||
            null;

          const channelPlacement = {
            categoryId: categoryId ?? null,
            categoryName: categoryName || null,
            categoryOrder: categoryOrder ?? null,
            chatOrder: chatOrder ?? null,
          };

          await callStore.leaveRoom();
          await callStore.joinRoom(channelId, channelName, serverId);
          callStore.registerCallOnlyVoiceChannel(channelId, channelName, channelPlacement);
          
          window.dispatchEvent(new CustomEvent('voiceChannelSwitched', {
            detail: { channelId, channelName, sourceChannelId, ...channelPlacement }
          }));
        } catch (error) {
          console.error('switchToChannel: Failed to switch channel:', error);
        }
      } else {
        console.log('switchToChannel: Not in source channel or no active room, skipping switch', {
          currentRoomId: this.roomId,
          sourceChannelId,
          hasRoom: !!this.room
        });
      }
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
    this.suppressReconnectEvent = true;

    if (this.room) {
      await releaseLiveKitLocalCapture(this.room);
      await this.room.disconnect();
      this.room = null;
    }
    
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.isConnected = false;
    this.hadSocketSession = false;
    this.roomId = null;
  }

  // Выход из комнаты без закрытия соединения (для быстрого переключения между каналами)
  async leaveRoom() {
    const previousRoomId = this.roomId;
    
    if (this.room) {
      await releaseLiveKitLocalCapture(this.room);
      await this.room.disconnect();
      this.room = null;
      this.roomId = null;
    }
    
    // Отправляем событие на сервер о выходе из канала
    if (this.socket && this.socket.connected && previousRoomId) {
      this.socket.emit('leave', { roomId: previousRoomId });
      console.log('leaveRoom: Sent leave event for room:', previousRoomId);
    }
    
    // Сокет остается подключенным для быстрого переподключения
  }

  // Переключение пользователя в другой голосовой канал
  async switchUserToChannel(userId, targetChannelId) {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.socket.connected) {
        reject(new Error('Not connected to voice server'));
        return;
      }

      console.log('switchUserToChannel: Switching user', userId, 'to channel', targetChannelId);
      
      this.socket.emit('switchUserToChannel', { userId, targetChannelId }, (response) => {
        if (response && response.error) {
          reject(new Error(response.error));
          return;
        }
        console.log('switchUserToChannel: Success', response);
        resolve(response);
      });
    });
  }

  getExistingRemotePeers() {
    if (!this.room) return [];

    const peers = [];
    this.room.remoteParticipants.forEach((participant) => {
      peers.push({
        userId: participant.identity,
        peerId: participant.identity,
        id: participant.identity,
        name: participant.name || participant.identity,
        isMuted: false,
        isAudioEnabled: true,
        isGlobalAudioMuted: false,
      });
    });
    return peers;
  }

  syncExistingRemoteTracks() {
    if (!this.room) return;

    this.room.remoteParticipants.forEach((participant) => {
      participant.trackPublications.forEach((publication) => {
        const hasActiveTrack = publication.isSubscribed &&
          publication.track &&
          publication.track.mediaStreamTrack &&
          publication.track.mediaStreamTrack.readyState !== 'ended';

        if (!hasActiveTrack) return;

        this.emit('trackSubscribed', {
          track: publication.track,
          publication,
          participant,
          trackSid: publication.trackSid,
          kind: publication.kind,
          participantIdentity: participant.identity,
          userId: participant.identity,
          mediaType: publication.source === Track.Source.ScreenShare ? 'screen' :
            publication.source === Track.Source.Camera ? 'camera' : 'microphone',
        });
      });
    });
  }

  async joinRoom(roomId, name, userId, initialMuted = false, initialAudioEnabled = true, avatar = null, avatarColor = '#5865f2', serverId = null) {
    if (this.room && this.roomId != null && String(this.roomId) === String(roomId)) {
      console.log('joinRoom: Already in this LiveKit room, syncing existing state');
      this.syncExistingRemoteTracks();
      return {
        alreadyJoined: true,
        existingPeers: this.getExistingRemotePeers(),
        existingProducers: [],
      };
    }

    // Если уже есть активная комната, выходим из неё перед присоединением к новой (await — иначе старый захват микрофона может пересекаться с новым)
    if (this.room && this.roomId !== roomId) {
      console.log(`joinRoom: Leaving current room (${this.roomId}) before joining new room (${roomId})`);
      const oldRoom = this.room;
      this.room = null;
      try {
        await releaseLiveKitLocalCapture(oldRoom);
        await oldRoom.disconnect();
      } catch (err) {
        console.warn('Error disconnecting from previous room:', err);
      }
    }

    return new Promise((resolve, reject) => {
      this.socket.emit('join', {
        roomId,
        name,
        userId,
        initialMuted,
        initialAudioEnabled,
        avatar,
        avatarColor,
        serverId: serverId ? String(serverId) : null,
      }, async (response) => {
        if (response && response.error) {
          reject(new Error(response.error));
          return;
        }

        try {
          this.roomId = roomId;
          
          // Если комната уже существует и это та же комната, не создаем новую
          if (this.room && this.roomId === roomId) {
            console.log('joinRoom: Already in this room, skipping reconnection');
            resolve({
              token: response.token,
              url: response.url,
              existingPeers: response.existingPeers || []
            });
            return;
          }
          
          // Create LiveKit room and connect
          const roomOptions = getRoomOptions();
          this.room = new Room(roomOptions);
          
          // Increase EventEmitter limit to avoid warnings
          if (this.room.setMaxListeners) {
            this.room.setMaxListeners(50);
          }

          // Connect to LiveKit
          await this.room.connect(response.url, response.token);
          console.log('Connected to LiveKit room:', roomId);

          // Set initial microphone state
          if (initialMuted) {
            await this.room.localParticipant.setMicrophoneEnabled(false);
          } else {
            await this.room.localParticipant.setMicrophoneEnabled(true);
          }

          // Set initial audio enabled state
          // Note: LiveKit doesn't have a direct "audio output enabled" concept
          // This is handled at the application level

          // Setup event listeners
          this.setupRoomEventListeners();
          
          // Handlers may register after connect; delay once so trackSubscribed listeners exist.
          setTimeout(() => {
            console.log('🔍 Checking for existing remote participants...');
            console.log('🔍 Remote participants count:', this.room.remoteParticipants.size);
            this.syncExistingRemoteTracks();
          }, 500);

          resolve({
            token: response.token,
            url: response.url,
            existingPeers: response.existingPeers || []
          });
        } catch (error) {
          console.error('Error connecting to LiveKit:', error);
          reject(error);
        }
      });
    });
  }

  setupRoomEventListeners() {
    if (!this.room) return;

    // Track published (remote participant published a track)
    this.room.on(RoomEvent.TrackPublished, (publication, participant) => {
      console.log('Track published:', {
        trackSid: publication.trackSid,
        kind: publication.kind,
        participantIdentity: participant.identity
      });
      
      // Emit newProducer event for compatibility with existing code
      this.emit('newProducer', {
        producerId: publication.trackSid,
        producerSocketId: participant.identity,
        kind: publication.kind,
        appData: {
          userId: participant.identity,
          mediaType: this.getPublicationMediaType(publication)
        }
      });
    });

    // Track subscribed (we subscribed to a remote track)
    this.room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
      console.log('Track subscribed:', {
        trackSid: track.sid,
        kind: track.kind,
        participantIdentity: participant.identity
      });
      
      // Emit trackSubscribed event for useVoiceCall to handle
      this.emit('trackSubscribed', {
        track,
        publication,
        participant,
        trackSid: track.sid,
        kind: track.kind,
        participantIdentity: participant.identity,
        userId: participant.identity,
        mediaType: this.getPublicationMediaType(publication)
      });
    });

    // Track unmuted
    this.room.on(RoomEvent.TrackUnmuted, (publication, participant) => {
      console.log('Track unmuted:', {
        trackSid: publication.trackSid,
        kind: publication.kind,
        participantIdentity: participant.identity
      });

      // Mic mute UI is driven by socket peerMuteStateChanged / globalMuteState.
      // LiveKit TrackMuted/TrackUnmuted during enable/disable causes false flashes.

      // Emit video state change for video
      if (publication.kind === Track.Kind.Video) {
        console.log('🎥 Video track unmuted for participant:', participant.identity);
        this.emit('peerVideoStateChanged', {
          peerId: participant.identity,
          isVideoEnabled: true,
          userId: participant.identity,
          track: publication.track,
          mediaType: publication.source === Track.Source.ScreenShare ? 'screen' : 'camera'
        });
      }
    });

    // Track muted
    this.room.on(RoomEvent.TrackMuted, (publication, participant) => {
      console.log('Track muted:', {
        trackSid: publication.trackSid,
        kind: publication.kind,
        participantIdentity: participant.identity
      });

      // Emit video state change for video
      if (publication.kind === Track.Kind.Video) {
        console.log('🎥 Video track muted for participant:', participant.identity);
        this.emit('peerVideoStateChanged', {
          peerId: participant.identity,
          isVideoEnabled: false,
          userId: participant.identity,
          track: null,
          mediaType: publication.source === Track.Source.ScreenShare ? 'screen' : 'camera'
        });
      }
    });

    // Participant connected
    this.room.on(RoomEvent.ParticipantConnected, (participant) => {
      console.log('Participant connected:', participant.identity);
      
      // Check for existing tracks that are already subscribed
      participant.trackPublications.forEach((publication) => {
        const hasActiveTrack = publication.isSubscribed &&
          publication.track &&
          publication.track.mediaStreamTrack &&
          publication.track.mediaStreamTrack.readyState !== 'ended';

        if (hasActiveTrack) {
          console.log('Found existing subscribed track for participant:', participant.identity, publication.kind);
          // Emit trackSubscribed event for existing tracks
          this.emit('trackSubscribed', {
            track: publication.track,
            publication: publication,
            participant: participant,
            trackSid: publication.trackSid,
            kind: publication.kind,
            participantIdentity: participant.identity,
            userId: participant.identity,
            mediaType: this.getPublicationMediaType(publication)
          });
        }
      });
      
      this.emit('peerJoined', {
        peerId: participant.identity,
        name: participant.name || participant.identity,
        userId: participant.identity,
        isMuted: !participant.isMicrophoneEnabled,
        isAudioEnabled: true
      });
    });

    // Participant disconnected
    this.room.on(RoomEvent.ParticipantDisconnected, (participant) => {
      console.log('Participant disconnected:', participant.identity);
      
      this.emit('peerLeft', {
        peerId: participant.identity,
        id: participant.identity,
        userId: participant.identity,
      });
    });

    // Track unpublished (remote participant stopped publishing)
    this.room.on(RoomEvent.TrackUnpublished, (publication, participant) => {
      console.log('Track unpublished:', {
        trackSid: publication.trackSid,
        kind: publication.kind,
        participantIdentity: participant.identity
      });
      
      // Emit producerClosed event for compatibility
      const mediaType = publication.source === Track.Source.ScreenShare ? 'screen' : 
                        publication.source === Track.Source.Camera ? 'camera' : 'microphone';
      
      this.emit('producerClosed', {
        producerId: publication.trackSid,
        producerSocketId: participant.identity,
        mediaType: mediaType,
        kind: publication.kind
      });
    });
  }

  // Get local audio track
  getLocalAudioTrack() {
    if (!this.room) return null;
    const audioTrack = this.room.localParticipant.audioTrackPublications.values().next().value;
    return audioTrack?.track || null;
  }

  // Get local video track
  getLocalVideoTrack() {
    if (!this.room) return null;
    const videoTrack = this.room.localParticipant.videoTrackPublications.values().next().value;
    return videoTrack?.track || null;
  }

  // Get remote tracks for a participant
  getRemoteTracks(participantIdentity) {
    if (!this.room) return { audio: null, video: null };
    
    const participant = this.room.remoteParticipants.get(participantIdentity);
    if (!participant) return { audio: null, video: null };

    const audioTrack = participant.audioTrackPublications.values().next().value;
    const videoTrack = participant.videoTrackPublications.values().next().value;

    return {
      audio: audioTrack?.track || null,
      video: videoTrack?.track || null
    };
  }

  // Notify server about mute state without changing LiveKit track (in-app soundpad keeps mic published).
  broadcastMuteState(isMuted) {
    if (this.socket) {
      this.socket.emit('muteState', { isMuted: Boolean(isMuted) });
    }
  }

  emitServerVoiceModeration(payload) {
    if (this.socket?.connected) {
      this.socket.emit('serverVoiceModeration', payload);
    }
  }

  // Enable/disable microphone
  async setMicrophoneEnabled(enabled) {
    if (!this.room) {
      throw new Error('Not connected to room');
    }
    
    await this.room.localParticipant.setMicrophoneEnabled(enabled);
    this.broadcastMuteState(!enabled);
  }

  // Enable/disable camera
  async setCameraEnabled(enabled) {
    if (!this.room) {
      throw new Error('Not connected to room');
    }
    
    if (enabled) {
      // Камера: 1080p/30fps, VP8 (меньше нагрузка на CPU чем VP9 — без лагов), simulcast [h360, h720]
      await this.room.localParticipant.setCameraEnabled(
        true,
        {
          resolution: VideoPresets.h1080.resolution,
          frameRate: 30
        },
        {
          videoCodec: 'vp8',
          videoEncoding: VideoPresets.h1080.encoding,
          simulcast: true,
          videoSimulcastLayers: [VideoPresets.h360, VideoPresets.h720]
        }
      );
    } else {
      await this.room.localParticipant.setCameraEnabled(false);
    }
  }

  // Enable/disable screen share
  async setScreenShareEnabled(enabled, options = {}) {
    if (!this.room) {
      throw new Error('Not connected to room');
    }
    const { includeAudio = true } = options;

    if (enabled) {
      // Defensive cleanup for stale publications before enabling a new share.
      const hasActiveOrStaleScreenVideoPublication = Array.from(
        this.room.localParticipant.videoTrackPublications.values()
      ).some((publication) => publication.source === Track.Source.ScreenShare);

      const hasActiveOrStaleScreenAudioPublication = Array.from(
        this.room.localParticipant.audioTrackPublications.values()
      ).some((publication) => publication.source === Track.Source.ScreenShareAudio);

      if (hasActiveOrStaleScreenVideoPublication || hasActiveOrStaleScreenAudioPublication) {
        try {
          await this.room.localParticipant.setScreenShareEnabled(false);
          await this.waitForScreenShareCleared();
        } catch (error) {
          console.warn('Failed to disable previous screen share before re-enable:', error);
        }
      }

      // Give LiveKit a short settle window between unpublish/publish cycles.
      // Without this, rapid restart may yield an already-ended incoming track
      // on remote subscribers in some browser/runtime combinations.
      await new Promise((resolve) => setTimeout(resolve, 120));

      const startProfiles = includeAudio
        ? [
            {
              name: 'balanced-audio',
              capture: {
                audio: {
                  echoCancellation: false,
                  noiseSuppression: false,
                  autoGainControl: false,
                  channelCount: 2
                },
                resolution: VideoPresets.h720.resolution,
                frameRate: 60
              },
              publish: {
                videoCodec: 'vp8',
                videoEncoding: {
                  ...VideoPresets.h720.encoding,
                  maxBitrate: 2_500_000,
                  maxFramerate: 60
                },
                simulcast: false
              }
            },
            {
              name: 'compatibility-audio',
              capture: {
                audio: {
                  echoCancellation: false,
                  noiseSuppression: false,
                  autoGainControl: false
                },
                resolution: VideoPresets.h720.resolution,
                frameRate: 30
              },
              publish: {
                videoCodec: 'vp8',
                simulcast: false
              }
            },
            {
              name: 'minimal-audio',
              capture: {
                audio: {
                  echoCancellation: false,
                  noiseSuppression: false,
                  autoGainControl: false
                }
              },
              publish: null
            }
          ]
        : [
            {
              name: 'video-only',
              capture: {
                audio: false,
                resolution: VideoPresets.h720.resolution,
                frameRate: 60
              },
              publish: {
                videoCodec: 'vp8',
                videoEncoding: {
                  ...VideoPresets.h720.encoding,
                  maxBitrate: 2_500_000,
                  maxFramerate: 60
                },
                simulcast: false
              }
            }
          ];

      let lastError = null;
      for (let i = 0; i < startProfiles.length; i += 1) {
        const profile = startProfiles[i];
        try {
          if (profile.publish) {
            await this.room.localParticipant.setScreenShareEnabled(true, profile.capture, profile.publish);
          } else {
            await this.room.localParticipant.setScreenShareEnabled(true, profile.capture);
          }

          if (!includeAudio) {
            return;
          }

          const audioPublished = await this.waitForScreenShareAudioPublished();
          if (audioPublished) {
            this.tuneLocalScreenShareAudioTrack();
            return;
          }

          lastError = new Error(
            `Screen-share audio track was not published (profile: ${profile.name})`
          );
          console.warn(lastError.message);
        } catch (error) {
          lastError = error;
          console.warn(`Screen share start failed for profile "${profile.name}":`, error);
        }

        // Cleanup before next profile attempt.
        try {
          await this.room.localParticipant.setScreenShareEnabled(false);
        } catch (disableError) {
          console.warn('Failed to disable screen share after failed attempt:', disableError);
        }
        await this.waitForScreenShareCleared();

        // Short settle window before next retry.
        await new Promise((resolve) => setTimeout(resolve, 120));
      }

      if (lastError) {
        throw lastError;
      }
      throw new Error('Failed to start screen sharing');
    } else {
      await this.room.localParticipant.setScreenShareEnabled(false);
      await this.waitForScreenShareCleared();
    }
  }

  // Get room instance
  getRoom() {
    return this.room;
  }

  // Event emitter methods for compatibility
  on(event, callback) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event).push(callback);
  }

  off(event, callback) {
    if (!this.eventHandlers.has(event)) return;

    // If callback is not provided, remove all handlers for event.
    // callStore cleanup relies on this shorthand.
    if (!callback) {
      this.eventHandlers.set(event, []);
      return;
    }

    const handlers = this.eventHandlers.get(event);
    const index = handlers.indexOf(callback);
    if (index > -1) {
      handlers.splice(index, 1);
    }
  }

  emit(event, data) {
    if (!this.eventHandlers.has(event)) return;
    
    const handlers = this.eventHandlers.get(event);
    handlers.forEach(handler => {
      try {
        handler(data);
      } catch (error) {
        console.error(`Error in event handler for ${event}:`, error);
      }
    });
  }

  // Legacy methods for compatibility (no-op for LiveKit)
  async initializeDevice(routerRtpCapabilities) {
    // No-op for LiveKit
    return null;
  }

  async createWebRtcTransport() {
    throw new Error('createWebRtcTransport is not used with LiveKit');
  }

  async connectTransport(transportId, dtlsParameters) {
    throw new Error('connectTransport is not used with LiveKit');
  }

  async produce(transportId, kind, rtpParameters, appData) {
    throw new Error('produce is not used with LiveKit');
  }

  async consume(rtpCapabilities, remoteProducerId, transportId) {
    throw new Error('consume is not used with LiveKit');
  }

  async resumeConsumer(consumerId) {
    throw new Error('resumeConsumer is not used with LiveKit');
  }

  // Methods for stopping screen sharing and video (for compatibility)
  async stopScreenSharing(producerId) {
    if (!this.room) {
      return { success: true };
    }
    
    try {
      await this.room.localParticipant.setScreenShareEnabled(false);
      return { success: true };
    } catch (error) {
      console.error('Error stopping screen share:', error);
      return { success: true }; // Return success anyway to not block UI
    }
  }

  async stopVideo(producerId) {
    if (!this.room) {
      return { success: true };
    }
    
    try {
      await this.room.localParticipant.setCameraEnabled(false);
      return { success: true };
    } catch (error) {
      console.error('Error stopping video:', error);
      return { success: true }; // Return success anyway to not block UI
    }
  }
}

export const voiceCallApi = new VoiceCallApi();
