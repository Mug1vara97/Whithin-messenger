import { io } from 'socket.io-client';
import { Room, RoomEvent, Track, TrackPublication, VideoPresets } from 'livekit-client';

// Конфигурация для голосового сервера
const VOICE_SERVER_URL = import.meta.env.VITE_VOICE_SERVER_URL || 'https://whithin.ru';
const VOICE_SERVER_CONFIG = {
  transports: ['websocket'],
  upgrade: false,
  rememberUpgrade: false
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
    audioCaptureDefaults: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      sampleRate: 48000,
      channelCount: 1
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

class VoiceCallApi {
  constructor() {
    this.socket = null;
    this.room = null;
    this.isConnected = false;
    this.roomId = null;
    this.userId = null;
    this.userName = null;
    this.eventHandlers = new Map();
  }

  async waitForScreenShareCleared(timeoutMs = 3000) {
    if (!this.room) return;

    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      const hasScreenSharePublication = Array.from(
        this.room.localParticipant.videoTrackPublications.values()
      ).some((publication) => publication.source === Track.Source.ScreenShare);

      if (!hasScreenSharePublication) {
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, 50));
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
    this.socket.on('disconnect', () => {
      console.log('Disconnected from voice server');
      this.isConnected = false;
    });

    // Обработчик переключения в другой канал (от сервера)
    this.socket.on('switchToChannel', async ({ channelId, sourceChannelId }) => {
      console.log('switchToChannel: Received switch command to channel', channelId, 'from', sourceChannelId);
      
      // Если мы находимся в исходном канале, переключаемся
      if (this.roomId === sourceChannelId && this.room) {
        try {
          // Используем callStore для правильного переключения
          const { useCallStore } = await import('../../../shared/lib/stores/callStore');
          const callStore = useCallStore.getState();
          
          // Всегда получаем название нового канала (не используем старое название)
          let channelName = null;
          
          try {
            // Пытаемся получить название канала через API
            const { serverApi } = await import('../../server/api/serverApi');
            // Пытаемся найти serverId из URL
            const serverId = window.location.pathname.match(/\/server\/([^\/]+)/)?.[1];
            
            if (serverId) {
              try {
                const serverData = await serverApi.getServerById(serverId);
                const allChannels = serverData.categories?.flatMap(cat => cat.chats || cat.Chats || []) || [];
                const foundChannel = allChannels.find(chat => 
                  (chat.chatId || chat.ChatId || chat.chat_id) === channelId
                );
                if (foundChannel) {
                  channelName = foundChannel.name || foundChannel.Name || foundChannel.groupName;
                  console.log('switchToChannel: Found channel name from API:', channelName, 'for channelId:', channelId);
                }
              } catch (apiErr) {
                console.warn('switchToChannel: Failed to get channel name from API:', apiErr);
              }
            }
            
            // Если не нашли через API, пытаемся получить из window (если доступно)
            if (!channelName && window.__serverData__) {
              const serverData = window.__serverData__;
              const allChannels = serverData.categories?.flatMap(cat => cat.chats || cat.Chats || []) || [];
              const foundChannel = allChannels.find(chat => 
                (chat.chatId || chat.ChatId || chat.chat_id) === channelId
              );
              if (foundChannel) {
                channelName = foundChannel.name || foundChannel.Name || foundChannel.groupName;
                console.log('switchToChannel: Found channel name from window:', channelName, 'for channelId:', channelId);
              }
            }
          } catch (err) {
            console.warn('switchToChannel: Failed to get channel name:', err);
          }
          
          // Если не удалось получить название, используем channelId
          if (!channelName) {
            channelName = channelId;
            console.warn('switchToChannel: Could not find channel name, using channelId:', channelId);
          }
          
          console.log('switchToChannel: About to switch, channelName:', channelName, 'channelId:', channelId);
          
          // Выходим из текущей комнаты через callStore
          await callStore.leaveRoom();
          
          // Присоединяемся к новому каналу через callStore с названием
          await callStore.joinRoom(channelId, channelName);
          
          console.log('switchToChannel: Successfully switched to channel', channelId, 'with name', channelName);
          
          // Эмитим событие для обновления интерфейса ПОСЛЕ переключения (HomePage может слушать это событие)
          window.dispatchEvent(new CustomEvent('voiceChannelSwitched', {
            detail: { channelId, channelName, sourceChannelId }
          }));
          console.log('switchToChannel: Dispatched voiceChannelSwitched event with channelName:', channelName);
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
    if (this.room) {
      await this.room.disconnect();
      this.room = null;
    }
    
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.isConnected = false;
    this.roomId = null;
  }

  // Выход из комнаты без закрытия соединения (для быстрого переключения между каналами)
  async leaveRoom() {
    const previousRoomId = this.roomId;
    
    if (this.room) {
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

  async joinRoom(roomId, name, userId, initialMuted = false, initialAudioEnabled = true, avatar = null, avatarColor = '#5865f2') {
    return new Promise((resolve, reject) => {
      // Если уже есть активная комната, выходим из неё перед присоединением к новой
      if (this.room && this.roomId !== roomId) {
        console.log(`joinRoom: Leaving current room (${this.roomId}) before joining new room (${roomId})`);
        this.room.disconnect().catch(err => {
          console.warn('Error disconnecting from previous room:', err);
        });
        this.room = null;
      }
      
      this.socket.emit('join', {
        roomId,
        name,
        userId,
        initialMuted,
        initialAudioEnabled,
        avatar,
        avatarColor
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
          
          // Check for existing remote participants and their tracks
          // Emit events - handlers will process them when registered (callStore or useVoiceCall)
          setTimeout(() => {
            console.log('🔍 Checking for existing remote participants...');
            console.log('🔍 Remote participants count:', this.room.remoteParticipants.size);
            console.log('🔍 TrackSubscribed handlers count:', this.eventHandlers.get('trackSubscribed')?.length || 0);
            
            this.room.remoteParticipants.forEach((participant) => {
              console.log('🔍 Found existing remote participant:', participant.identity);
              // Check for existing subscribed tracks
              participant.trackPublications.forEach((publication) => {
                const hasActiveTrack = publication.isSubscribed &&
                  publication.track &&
                  publication.track.mediaStreamTrack &&
                  publication.track.mediaStreamTrack.readyState !== 'ended';

                if (hasActiveTrack) {
                  console.log('🔍 Found existing subscribed track for participant:', participant.identity, publication.kind);
                  console.log('🔍 Track details:', {
                    trackSid: publication.trackSid,
                    hasTrack: !!publication.track,
                    hasMediaStreamTrack: !!publication.track?.mediaStreamTrack,
                    trackState: publication.track?.mediaStreamTrack?.readyState
                  });
                  
                  // Emit trackSubscribed event for existing tracks
                  // Note: This will be handled by callStore.handleNewProducer or useVoiceCall trackSubscribed handler
                  console.log('🔍 Emitting trackSubscribed event...');
                  this.emit('trackSubscribed', {
                    track: publication.track,
                    publication: publication,
                    participant: participant,
                    trackSid: publication.trackSid,
                    kind: publication.kind,
                    participantIdentity: participant.identity,
                    userId: participant.identity,
                    mediaType: publication.source === Track.Source.ScreenShare ? 'screen' : 
                               publication.source === Track.Source.Camera ? 'camera' : 'microphone'
                  });
                  console.log('🔍 trackSubscribed event emitted');
                }
              });
            });
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
          mediaType: publication.source === Track.Source.ScreenShare ? 'screen' : 
                     publication.source === Track.Source.Camera ? 'camera' : 'microphone'
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
        mediaType: publication.source === Track.Source.ScreenShare ? 'screen' : 
                   publication.source === Track.Source.Camera ? 'camera' : 'microphone'
      });
    });

    // Track unmuted
    this.room.on(RoomEvent.TrackUnmuted, (publication, participant) => {
      console.log('Track unmuted:', {
        trackSid: publication.trackSid,
        kind: publication.kind,
        participantIdentity: participant.identity
      });
      
      // Emit mute state change for audio
      if (publication.kind === Track.Kind.Audio) {
        this.emit('peerMuteStateChanged', {
          peerId: participant.identity,
          isMuted: false,
          userId: participant.identity
        });
      }
      
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
      
      // Emit mute state change for audio
      if (publication.kind === Track.Kind.Audio) {
        this.emit('peerMuteStateChanged', {
          peerId: participant.identity,
          isMuted: true,
          userId: participant.identity
        });
      }
      
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
            mediaType: publication.source === Track.Source.ScreenShare ? 'screen' : 
                       publication.source === Track.Source.Camera ? 'camera' : 'microphone'
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
        id: participant.identity
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

  // Enable/disable microphone
  async setMicrophoneEnabled(enabled) {
    if (!this.room) {
      throw new Error('Not connected to room');
    }
    
    await this.room.localParticipant.setMicrophoneEnabled(enabled);
    
    // Notify server about mute state
    if (this.socket) {
      this.socket.emit('muteState', { isMuted: !enabled });
    }
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
  async setScreenShareEnabled(enabled) {
    if (!this.room) {
      throw new Error('Not connected to room');
    }
    
    if (enabled) {
      // Defensive cleanup for stale publications before enabling a new share.
      const hasActiveOrStaleScreenPublication = Array.from(
        this.room.localParticipant.videoTrackPublications.values()
      ).some((publication) => publication.source === Track.Source.ScreenShare);

      if (hasActiveOrStaleScreenPublication) {
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

      // Demonstration screen-share profile tuned for stability across restarts.
      // VP8 + no simulcast is less fragile than VP9/SVC in some desktop runtimes.
      await this.room.localParticipant.setScreenShareEnabled(
        true,
        {
          // Always request capture of system/tab audio for screen sharing.
          // Browsers may still require explicit user consent in the picker UI.
          audio: true,
          resolution: VideoPresets.h1080.resolution,
          frameRate: 30
        },
        {
          videoCodec: 'vp8',
          videoEncoding: VideoPresets.h1080.encoding,
          simulcast: false
        }
      );
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
