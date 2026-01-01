import { Room, RoomEvent, RemoteParticipant, LocalParticipant, Track, TrackPublication } from 'livekit-client';

// Конфигурация для голосового сервера
const VOICE_SERVER_URL = import.meta.env.VITE_VOICE_SERVER_URL || 'https://whithin.ru';
const VOICE_SERVER_CONFIG = {
  transports: ['websocket'],
  upgrade: false,
  rememberUpgrade: false
};

class LiveKitApi {
  constructor() {
    this.socket = null;
    this.room = null;
    this.isConnected = false;
    this.userId = null;
    this.userName = null;
    this.currentRoomId = null;
  }

  async connect(userId, userName, serverUrl = VOICE_SERVER_URL) {
    if (this.socket && this.isConnected) {
      return this.socket;
    }

    this.userId = userId;
    this.userName = userName;

    // Подключаемся к нашему Go серверу через WebSocket (не socket.io!)
    // Преобразуем URL в WebSocket формат
    const wsUrl = serverUrl.replace(/^https?/, serverUrl.startsWith('https') ? 'wss' : 'ws') + '/ws';
    this.socket = new WebSocket(wsUrl);

    // Регистрируем базовые обработчики WebSocket
    this.socket.onopen = () => {
      this.isConnected = true;
      console.log('Voice call connection established');
    };

    this.socket.onclose = () => {
      console.log('Disconnected from voice server');
      this.isConnected = false;
    };

    this.socket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    // Обработчик сообщений
    this.socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        // Эмитим событие для обработки в joinRoom
        if (this.messageHandlers) {
          this.messageHandlers.forEach(handler => handler(msg));
        }
      } catch (error) {
        console.error('Failed to parse message:', error);
      }
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, 10000);

      this.socket.onopen = () => {
        clearTimeout(timeout);
        this.isConnected = true;
        console.log('Voice call connection established');
        resolve(this.socket);
      };

      this.socket.onerror = (error) => {
        clearTimeout(timeout);
        console.error('Failed to connect to voice server:', error);
        reject(error);
      };
    });
  }

  async disconnect() {
    if (this.room) {
      await this.room.disconnect();
      this.room = null;
    }
    
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    
    this.messageHandlers = null;
    this.isConnected = false;
    this.currentRoomId = null;
  }

  async joinRoom(roomId, name, userId, initialMuted = false, initialAudioEnabled = true) {
    return new Promise((resolve, reject) => {
      if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
        reject(new Error('WebSocket not connected'));
        return;
      }

      // Обработчик ответа от сервера (WebSocket формат: {event, data})
      const handleResponse = async (msg) => {
        if (msg.event === 'joined') {
          const response = msg.data;
          
          if (response && response.error) {
            // Удаляем обработчик
            this.messageHandlers = this.messageHandlers.filter(h => h !== handleResponse);
            reject(new Error(response.error));
            return;
          }

          try {
            // Создаем LiveKit комнату
            const room = new Room({
              adaptiveStream: true,
              dynacast: true,
              videoCaptureDefaults: {
                resolution: { width: 1280, height: 720 },
                facingMode: 'user'
              }
            });

            // Регистрируем обработчики событий комнаты
            this.setupRoomEventHandlers(room);

            // Подключаемся к LiveKit серверу используя токен
            await room.connect(response.url, response.token);

          this.room = room;
          this.currentRoomId = roomId;

          // Получаем локального участника
          const localParticipant = room.localParticipant;

          // Устанавливаем начальное состояние микрофона
          if (localParticipant.audioTrackPublications.size > 0) {
            const audioTrack = Array.from(localParticipant.audioTrackPublications.values())[0];
            if (audioTrack.track) {
              audioTrack.track.setEnabled(!initialMuted);
            }
          }

            // Удаляем обработчик после успешного подключения
            this.messageHandlers = this.messageHandlers.filter(h => h !== handleResponse);
            
            resolve({
              room,
              existingPeers: response.existingPeers || [],
              existingProducers: [] // LiveKit управляет этим автоматически
            });
          } catch (error) {
            // Удаляем обработчик при ошибке
            this.messageHandlers = this.messageHandlers.filter(h => h !== handleResponse);
            console.error('Failed to connect to LiveKit room:', error);
            reject(error);
          }
        } else if (msg.event === 'error') {
          // Удаляем обработчик при ошибке
          this.messageHandlers = this.messageHandlers.filter(h => h !== handleResponse);
          reject(new Error(msg.data?.error || 'Unknown error'));
        }
      };

      // Инициализируем массив обработчиков если нужно
      if (!this.messageHandlers) {
        this.messageHandlers = [];
      }
      
      // Подписываемся на ответы от сервера
      this.messageHandlers.push(handleResponse);
      
      // Отправляем запрос на присоединение к комнате
      // Используем формат {event, data} для совместимости с Go сервером
      this.socket.send(JSON.stringify({
        event: 'join',
        data: {
          roomId,
          name,
          userId,
          initialMuted,
          initialAudioEnabled
        }
      }));
      
      // Таймаут на случай отсутствия ответа
      setTimeout(() => {
        this.messageHandlers = this.messageHandlers.filter(h => h !== handleResponse);
        reject(new Error('Join timeout'));
      }, 10000);
    });
  }

  setupRoomEventHandlers(room) {
    // Участник присоединился
    room.on(RoomEvent.ParticipantConnected, (participant) => {
      console.log('Participant connected:', participant.identity);
      this.emit('peerJoined', {
        userId: participant.identity,
        name: participant.name || participant.identity,
        isMuted: !participant.isMicrophoneEnabled,
        isAudioEnabled: participant.isAudioEnabled,
        isGlobalAudioMuted: false // LiveKit не имеет этого концепта напрямую
      });
    });

    // Участник покинул
    room.on(RoomEvent.ParticipantDisconnected, (participant) => {
      console.log('Participant disconnected:', participant.identity);
      this.emit('peerLeft', {
        userId: participant.identity,
        name: participant.name || participant.identity
      });
    });

    // Изменение состояния микрофона
    room.on(RoomEvent.TrackMuted, (publication, participant) => {
      if (publication.kind === 'audio' && participant instanceof RemoteParticipant) {
        this.emit('peerMuteStateChanged', {
          peerId: participant.identity,
          userId: participant.identity,
          isMuted: true
        });
      }
    });

    room.on(RoomEvent.TrackUnmuted, (publication, participant) => {
      if (publication.kind === 'audio' && participant instanceof RemoteParticipant) {
        this.emit('peerMuteStateChanged', {
          peerId: participant.identity,
          userId: participant.identity,
          isMuted: false
        });
      }
    });

    // Новый трек опубликован
    room.on(RoomEvent.TrackPublished, (publication, participant) => {
      if (participant instanceof RemoteParticipant) {
        this.emit('newProducer', {
          producerId: publication.trackSid,
          producerSocketId: participant.identity,
          kind: publication.kind,
          appData: {
            userId: participant.identity,
            userName: participant.name,
            mediaType: publication.source === Track.Source.ScreenShare ? 'screen' : 
                      publication.source === Track.Source.Camera ? 'camera' : 'microphone'
          }
        });
      }
    });

    // Трек отключен
    room.on(RoomEvent.TrackUnpublished, (publication, participant) => {
      if (participant instanceof RemoteParticipant) {
        this.emit('producerClosed', {
          producerId: publication.trackSid,
          producerSocketId: participant.identity,
          kind: publication.kind,
          mediaType: publication.source === Track.Source.ScreenShare ? 'screen' : 
                    publication.source === Track.Source.Camera ? 'camera' : 'microphone'
        });
      }
    });

    // Изменение состояния говорения
    room.on(RoomEvent.AudioPlaybackStatusChanged, (status, participant) => {
      if (participant instanceof RemoteParticipant) {
        // LiveKit предоставляет информацию о говорении через audio level
        // Можно использовать для определения активности голоса
      }
    });
  }

  getRoom() {
    return this.room;
  }

  // Отправка состояния мута на сервер
  sendMuteState(isMuted) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({
        event: 'muteState',
        data: { isMuted }
      }));
    }
  }

  // Отправка состояния аудио на сервер
  sendAudioState(isEnabled, isGlobalAudioMuted) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({
        event: 'audioState',
        data: { 
          isEnabled, 
          isGlobalAudioMuted,
          userId: this.userId
        }
      }));
    }
  }

  // Обработчики событий (для совместимости, но не используются с WebSocket)
  on(event, callback) {
    // WebSocket обрабатывает сообщения через onmessage
    // Для кастомных событий можно использовать отдельный механизм
    if (!this.customHandlers) {
      this.customHandlers = new Map();
    }
    if (!this.customHandlers.has(event)) {
      this.customHandlers.set(event, []);
    }
    this.customHandlers.get(event).push(callback);
  }

  off(event, callback) {
    if (this.customHandlers && this.customHandlers.has(event)) {
      const handlers = this.customHandlers.get(event);
      const index = handlers.indexOf(callback);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  emit(event, data) {
    // Эмитим кастомные события
    if (this.customHandlers && this.customHandlers.has(event)) {
      this.customHandlers.get(event).forEach(callback => callback(data));
    }
  }

  // Остановка демонстрации экрана
  async stopScreenSharing() {
    if (this.room && this.room.localParticipant) {
      const screenShareTrack = Array.from(this.room.localParticipant.videoTrackPublications.values())
        .find(pub => pub.source === Track.Source.ScreenShare);
      
      if (screenShareTrack) {
        await this.room.localParticipant.unpublishTrack(screenShareTrack.track);
      }
    }
  }

  // Остановка вебкамеры
  async stopVideo() {
    if (this.room && this.room.localParticipant) {
      const cameraTrack = Array.from(this.room.localParticipant.videoTrackPublications.values())
        .find(pub => pub.source === Track.Source.Camera);
      
      if (cameraTrack) {
        await this.room.localParticipant.unpublishTrack(cameraTrack.track);
      }
    }
  }
}

export const livekitApi = new LiveKitApi();

