import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { voiceCallApi } from '../../../entities/voice-call/api/voiceCallApi';
import { NoiseSuppressionManager } from '../utils/noiseSuppression';

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

export const useCallStore = create(
  devtools(
    (set, get) => ({
      // Состояние звонка
      isConnected: false,
      isInCall: false,
      currentRoomId: null,
      currentUserId: null,
      currentUserName: null,
      currentCall: null,
      
      // Состояние участников
      participants: [],
      peerIdToUserIdMap: new Map(),
      processedProducers: new Set(),
      
      // Состояние аудио
      isMuted: false,
      isAudioEnabled: true, // Добавляем isAudioEnabled
      isGlobalAudioMuted: false,
      isNoiseSuppressed: false,
      noiseSuppressionMode: 'rnnoise',
      userVolumes: new Map(),
      userMutedStates: new Map(),
      showVolumeSliders: new Map(),
      
      // Состояние ошибок
      error: null,
      audioBlocked: false,
      
      // Состояние демонстрации экрана
      isScreenSharing: false,
      screenShareStream: null,
      remoteScreenShares: new Map(),
      
  // Состояние вебкамеры
  isVideoEnabled: false,
  cameraStream: null, // Отдельный поток для вебкамеры
  videoProducer: null, // Демонстрации экрана от других пользователей (producerId -> data)
      
      // WebRTC соединения (хранятся глобально)
      device: null,
      sendTransport: null,
      recvTransport: null,
      producers: new Map(),
      consumers: new Map(),
      localStream: null,
      noiseSuppressionManager: null,
      audioContext: null,
      gainNodes: new Map(),
      audioElements: new Map(),
      previousVolumes: new Map(),
      
      // Флаги состояния
      connecting: false,
      
      // Actions
      setError: (error) => set({ error }),
      clearError: () => set({ error: null }),
      
      setAudioBlocked: (blocked) => set({ audioBlocked: blocked }),
      
      // Инициализация звонка
      initializeCall: async (userId, userName) => {
        const state = get();
        if (state.connecting) {
          console.log('Connection already in progress, skipping');
          return;
        }
        
        set({ connecting: true, currentUserId: userId, currentUserName: userName });
        
        try {
          // Очищаем старые обработчики
          voiceCallApi.off('peerJoined');
          voiceCallApi.off('peerLeft');
          voiceCallApi.off('peerMuteStateChanged');
          voiceCallApi.off('peerAudioStateChanged');
          voiceCallApi.off('newProducer');
          voiceCallApi.off('producerClosed');
          voiceCallApi.off('globalAudioStateChanged');
          
          // Очищаем socket обработчики
          if (voiceCallApi.socket) {
            voiceCallApi.socket.off('globalAudioState');
          }
          
          await voiceCallApi.connect(userId, userName);
          
          // Регистрируем обработчики событий
          voiceCallApi.on('peerJoined', (peerData) => {
            console.log('Peer joined:', peerData);
            const socketId = peerData.peerId || peerData.id;
            if (socketId && peerData.userId) {
              const newMap = new Map(get().peerIdToUserIdMap);
              newMap.set(socketId, peerData.userId);
              set({ peerIdToUserIdMap: newMap });
            }
            
            set((state) => ({
              participants: [...state.participants.filter(p => p.userId !== peerData.userId), {
                userId: peerData.userId,
                peerId: socketId,
                name: peerData.name,
                isMuted: peerData.isMuted || false,
                isAudioEnabled: peerData.isAudioEnabled !== undefined ? peerData.isAudioEnabled : true,
                isGlobalAudioMuted: peerData.isGlobalAudioMuted || false, // Добавляем статус глобального звука
                isSpeaking: false
              }]
            }));
          });

          voiceCallApi.on('peerLeft', (peerData) => {
            console.log('Peer left:', peerData);
            const socketId = peerData.peerId || peerData.id;
            const userId = peerData.userId || get().peerIdToUserIdMap.get(socketId);
            
            if (userId) {
              // Очищаем audio element
              const audioElement = get().audioElements.get(userId);
              if (audioElement) {
                audioElement.pause();
                audioElement.srcObject = null;
                if (audioElement.parentNode) {
                  audioElement.parentNode.removeChild(audioElement);
                }
              }
              
              // Очищаем gain node
              const gainNode = get().gainNodes.get(userId);
              if (gainNode) {
                try {
                  gainNode.disconnect();
                } catch (e) {
                  console.warn('Error disconnecting gain node:', e);
                }
              }
              
              // Очищаем состояния
              set((state) => {
                const newUserVolumes = new Map(state.userVolumes);
                const newUserMutedStates = new Map(state.userMutedStates);
                const newShowVolumeSliders = new Map(state.showVolumeSliders);
                const newGainNodes = new Map(state.gainNodes);
                const newAudioElements = new Map(state.audioElements);
                const newPreviousVolumes = new Map(state.previousVolumes);
                const newPeerIdToUserIdMap = new Map(state.peerIdToUserIdMap);
                
                newUserVolumes.delete(userId);
                newUserMutedStates.delete(userId);
                newShowVolumeSliders.delete(userId);
                newGainNodes.delete(userId);
                newAudioElements.delete(userId);
                newPreviousVolumes.delete(userId);
                newPeerIdToUserIdMap.delete(socketId);
                
                return {
                  userVolumes: newUserVolumes,
                  userMutedStates: newUserMutedStates,
                  showVolumeSliders: newShowVolumeSliders,
                  gainNodes: newGainNodes,
                  audioElements: newAudioElements,
                  previousVolumes: newPreviousVolumes,
                  peerIdToUserIdMap: newPeerIdToUserIdMap,
                  participants: state.participants.filter(p => p.userId !== userId)
                };
              });
            }
          });

          voiceCallApi.on('peerMuteStateChanged', ({ peerId, isMuted }) => {
            const userId = get().peerIdToUserIdMap.get(peerId) || peerId;
            set((state) => ({
              participants: state.participants.map(p => 
                p.userId === userId ? { ...p, isMuted: Boolean(isMuted), isSpeaking: isMuted ? false : p.isSpeaking } : p
              )
            }));
          });

          voiceCallApi.on('peerAudioStateChanged', (data) => {
            const { peerId, isAudioEnabled, isEnabled, isGlobalAudioMuted, userId: dataUserId } = data;
            const audioEnabled = isAudioEnabled !== undefined ? isAudioEnabled : isEnabled;
            const userId = dataUserId || get().peerIdToUserIdMap.get(peerId) || peerId;
            
            console.log('peerAudioStateChanged received:', { peerId, userId, isAudioEnabled: audioEnabled, isGlobalAudioMuted });
            console.log('Full data received:', data);
            
            set((state) => ({
              participants: state.participants.map(p => {
                if (p.userId === userId) {
                  const updated = { ...p, isAudioEnabled: Boolean(audioEnabled) };
                  // Если сервер передает isGlobalAudioMuted, используем его
                  if (isGlobalAudioMuted !== undefined) {
                    updated.isGlobalAudioMuted = isGlobalAudioMuted;
                    console.log('Updated participant with global audio state:', updated);
                  } else {
                    console.log('isGlobalAudioMuted not provided by server, keeping existing state');
                    // Не изменяем isGlobalAudioMuted, если сервер его не передает
                  }
                  return updated;
                }
                return p;
              })
            }));
          });

          voiceCallApi.on('newProducer', async (producerData) => {
            const state = get();
            if (state.device && state.recvTransport) {
              await state.handleNewProducer(producerData);
            }
          });

          voiceCallApi.on('producerClosed', (data) => {
            console.log('🎥 Producer closed event received:', data);
            
            const producerId = data.producerId || data;
            const producerSocketId = data.producerSocketId;
            const producerKind = data.kind; // video или audio
            const mediaType = data.mediaType; // screen или camera
            
            console.log('🎥 Producer closed parsed:', { producerId, producerSocketId, producerKind, mediaType });
            
            // Защита от дублирования обработки
            const state = get();
            if (state.processedProducers && state.processedProducers.has(producerId)) {
              console.log('🎥 Producer already processed, ignoring:', producerId);
              return;
            }
            
            // Отмечаем producer как обработанный
            set(state => ({
              processedProducers: new Set([...(state.processedProducers || []), producerId])
            }));
            
            // Проверяем, является ли это демонстрацией экрана
            const screenShare = state.remoteScreenShares.get(producerId);
            if (screenShare) {
              console.log('Screen share producer closed:', producerId);
              // Останавливаем поток
              if (screenShare.stream) {
                screenShare.stream.getTracks().forEach(track => track.stop());
              }
              // Удаляем из Map
              const newRemoteScreenShares = new Map(state.remoteScreenShares);
              newRemoteScreenShares.delete(producerId);
              set({ remoteScreenShares: newRemoteScreenShares });
            }
            
            // Проверяем, является ли это вебкамерой (video producer с mediaType camera)
            const userId = state.peerIdToUserIdMap.get(producerSocketId) || producerSocketId;
            
            // Если это аудио producer, не обрабатываем его здесь
            if (producerKind === 'audio' && mediaType !== 'screen') {
              console.log('🎥 Audio producer closed, ignoring to preserve audio stream');
              return;
            }
            
            // Если параметры kind и mediaType не приходят, проверяем по участникам
            let isVideoProducer = false;
            if (producerKind === 'video' && mediaType === 'camera') {
              isVideoProducer = true;
            } else if (mediaType === 'camera') {
              // Если mediaType === 'camera', то это точно video producer
              console.log('🎥 Detected video producer by mediaType:', userId);
              isVideoProducer = true;
            } else if (!producerKind && !mediaType) {
              // Альтернативная проверка: если у участника есть isVideoEnabled, то это может быть video producer
              const participant = state.participants.find(p => p.userId === userId);
              if (participant && participant.isVideoEnabled) {
                console.log('🎥 Detected video producer by participant state:', userId);
                isVideoProducer = true;
              }
            }
            
            if (userId && userId !== state.currentUserId && isVideoProducer) {
              console.log('🎥 Camera video producer closed for user:', userId);
              // Обновляем участника - отключаем вебкамеру
              set((state) => {
                const updatedParticipants = state.participants.map(p => 
                  p.userId === userId 
                    ? { ...p, isVideoEnabled: false, videoStream: null }
                    : p
                );
                console.log('🎥 Updated participants after video close:', updatedParticipants);
                return { participants: updatedParticipants };
              });
            }
            
            // Удаляем consumer только для video producer, не для audio
            if (isVideoProducer || mediaType === 'screen') {
              const consumer = get().consumers.get(producerId);
              if (consumer) {
                console.log('🎥 Closing consumer for producer:', producerId);
                consumer.close();
                set((state) => {
                  const newConsumers = new Map(state.consumers);
                  newConsumers.delete(producerId);
                  return { consumers: newConsumers };
                });
              }
            } else {
              console.log('🎥 Preserving consumer for audio producer:', producerId);
            }
            
            if (producerSocketId) {
              const userId = get().peerIdToUserIdMap.get(producerSocketId);
              if (userId) {
                // Очищаем audio element и gain node
                const audioElement = get().audioElements.get(userId);
                if (audioElement) {
                  audioElement.pause();
                  audioElement.srcObject = null;
                  if (audioElement.parentNode) {
                    audioElement.parentNode.removeChild(audioElement);
                  }
                }
                
                const gainNode = get().gainNodes.get(userId);
                if (gainNode) {
                  try {
                    gainNode.disconnect();
                  } catch (e) {
                    console.warn('Error disconnecting gain node:', e);
                  }
                }
                
                set((state) => {
                  const newUserVolumes = new Map(state.userVolumes);
                  const newUserMutedStates = new Map(state.userMutedStates);
                  const newShowVolumeSliders = new Map(state.showVolumeSliders);
                  const newGainNodes = new Map(state.gainNodes);
                  const newAudioElements = new Map(state.audioElements);
                  const newPreviousVolumes = new Map(state.previousVolumes);
                  
                  newUserVolumes.delete(userId);
                  newUserMutedStates.delete(userId);
                  newShowVolumeSliders.delete(userId);
                  newGainNodes.delete(userId);
                  newAudioElements.delete(userId);
                  newPreviousVolumes.delete(userId);
                  
                  return {
                    userVolumes: newUserVolumes,
                    userMutedStates: newUserMutedStates,
                    showVolumeSliders: newShowVolumeSliders,
                    gainNodes: newGainNodes,
                    audioElements: newAudioElements,
                    previousVolumes: newPreviousVolumes
                  };
                });
              }
            }
          });

          // Обработчик для синхронизации статуса глобального звука
          voiceCallApi.on('globalAudioStateChanged', (data) => {
            const { userId, isGlobalAudioMuted } = data;
            console.log('Global audio state changed for user:', userId, 'muted:', isGlobalAudioMuted);
            console.log('Current participants before update:', get().participants);
            
            set((state) => {
              const updatedParticipants = state.participants.map(p => 
                p.userId === userId ? { ...p, isGlobalAudioMuted } : p
              );
              console.log('Updated participants:', updatedParticipants);
              return { participants: updatedParticipants };
            });
          });

          // Временное решение: слушаем событие globalAudioState от сервера
          if (voiceCallApi.socket) {
            voiceCallApi.socket.on('globalAudioState', (data) => {
              console.log('Received globalAudioState from server:', data);
              const { userId, isGlobalAudioMuted } = data;
              
              set((state) => {
                const updatedParticipants = state.participants.map(p => 
                  p.userId === userId ? { ...p, isGlobalAudioMuted } : p
                );
                console.log('Updated participants with globalAudioState:', updatedParticipants);
                return { participants: updatedParticipants };
              });
            });
          }
          
          set({ isConnected: true, connecting: false, processedProducers: new Set() });
          
          // Отправляем начальные состояния на сервер
          if (voiceCallApi.socket) {
            voiceCallApi.socket.emit('muteState', { isMuted: get().isMuted });
            voiceCallApi.socket.emit('audioState', { isEnabled: !get().isGlobalAudioMuted });
          }
        } catch (error) {
          console.error('Failed to initialize call:', error);
          set({ error: error.message, connecting: false });
        }
      },
      
      // Присоединение к комнате
      joinRoom: async (roomId) => {
        const state = get();
        if (!state.isConnected) {
          console.error('Not connected to voice server');
          return;
        }
        
        try {
          console.log('Joining room:', roomId);
          const response = await voiceCallApi.joinRoom(roomId, state.currentUserName, state.currentUserId);
          
          if (response.routerRtpCapabilities) {
            await state.initializeDevice(response.routerRtpCapabilities);
          }
          
          if (response.existingPeers) {
            // Сохраняем маппинг для существующих пиров
            const newMap = new Map(state.peerIdToUserIdMap);
            response.existingPeers.forEach(peer => {
              const socketId = peer.peerId || peer.id;
              if (socketId && peer.userId) {
                newMap.set(socketId, peer.userId);
              }
            });
            
            set({
              peerIdToUserIdMap: newMap,
              participants: response.existingPeers.map(peer => ({
                userId: peer.userId,
                peerId: peer.peerId || peer.id,
                name: peer.name,
                isMuted: peer.isMuted || false,
                isAudioEnabled: peer.isAudioEnabled !== undefined ? peer.isAudioEnabled : true,
                isGlobalAudioMuted: peer.isGlobalAudioMuted || false, // Добавляем статус глобального звука
                isSpeaking: false
              }))
            });
          }
          
          if (response.existingProducers && response.existingProducers.length > 0) {
            for (const producer of response.existingProducers) {
              try {
                await state.handleNewProducer(producer);
              } catch (error) {
                console.error('Failed to process existing producer:', error);
              }
            }
          }
          
          // Создаем аудио поток
          await state.createAudioStream();
          
          set({ currentRoomId: roomId, isInCall: true, currentCall: { channelId: roomId, channelName: roomId } });
        } catch (error) {
          console.error('Failed to join room:', error);
          set({ error: error.message });
        }
      },
      
      // Инициализация устройства
      initializeDevice: async (routerRtpCapabilities) => {
        try {
          const device = await voiceCallApi.initializeDevice(routerRtpCapabilities);
          set({ device });
          await get().createTransports();
        } catch (error) {
          console.error('Failed to initialize device:', error);
          set({ error: error.message });
        }
      },
      
      // Создание транспортов
      createTransports: async () => {
        try {
          const state = get();
          if (!state.device) return;
          
          // Создание send transport
          const sendTransportData = await voiceCallApi.createWebRtcTransport();
          const sendTransport = state.device.createSendTransport({
            id: sendTransportData.id,
            iceParameters: sendTransportData.iceParameters,
            iceCandidates: sendTransportData.iceCandidates,
            dtlsParameters: sendTransportData.dtlsParameters,
            iceServers: ICE_SERVERS
          });

          sendTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
            try {
              await voiceCallApi.connectTransport(sendTransportData.id, dtlsParameters);
              callback();
            } catch (error) {
              errback(error);
            }
          });

          sendTransport.on('produce', async ({ kind, rtpParameters, appData }, callback, errback) => {
            try {
              const { id } = await voiceCallApi.produce(sendTransportData.id, kind, rtpParameters, appData);
              callback({ id });
            } catch (error) {
              errback(error);
            }
          });

          // Создание recv transport
          const recvTransportData = await voiceCallApi.createWebRtcTransport();
          const recvTransport = state.device.createRecvTransport({
            id: recvTransportData.id,
            iceParameters: recvTransportData.iceParameters,
            iceCandidates: recvTransportData.iceCandidates,
            dtlsParameters: recvTransportData.dtlsParameters,
            iceServers: ICE_SERVERS
          });

          recvTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
            try {
              await voiceCallApi.connectTransport(recvTransportData.id, dtlsParameters);
              callback();
            } catch (error) {
              errback(error);
            }
          });

          set({ sendTransport, recvTransport });
          console.log('Transports created');
        } catch (error) {
          console.error('Failed to create transports:', error);
          set({ error: error.message });
        }
      },
      
      // Обработка нового producer
      handleNewProducer: async (producerData) => {
        try {
          const state = get();
          if (!state.device || !state.recvTransport) return;
          
          const consumerData = await voiceCallApi.consume(
            state.device.rtpCapabilities,
            producerData.producerId,
            state.recvTransport.id
          );

          const consumer = await state.recvTransport.consume({
            id: consumerData.id,
            producerId: producerData.producerId,
            kind: producerData.kind,
            rtpParameters: consumerData.rtpParameters
          });

          set((state) => {
            const newConsumers = new Map(state.consumers);
            newConsumers.set(consumerData.id, consumer);
            return { consumers: newConsumers };
          });
          
          const socketId = producerData.producerSocketId;
          const userId = state.peerIdToUserIdMap.get(socketId) || socketId;
          
          // Проверяем, является ли это демонстрацией экрана
          const isScreenShare = producerData.appData?.mediaType === 'screen';
          console.log('callStore handleNewProducer: isScreenShare=', isScreenShare, 'kind=', producerData.kind, 'userId=', userId, 'currentUserId=', state.currentUserId, 'producerUserId=', producerData.appData?.userId);
          
          // Для демонстрации экрана обрабатываем video и audio отдельно
          if (isScreenShare) {
            // Проверяем, что это не наша собственная демонстрация экрана
            const producerUserId = producerData.appData?.userId;
            if (producerUserId === state.currentUserId) {
              console.log('Skipping own screen share producer in handleNewProducer', { userId, currentUserId: state.currentUserId, producerUserId });
              return;
            }
            
            console.log('Screen share producer detected in callStore:', { kind: producerData.kind, userId });
            
            if (producerData.kind === 'video') {
              // Создаем MediaStream из consumer track для отображения
              const screenStream = new MediaStream([consumer.track]);
              
              const currentState = get();
              const newRemoteScreenShares = new Map(currentState.remoteScreenShares);
              newRemoteScreenShares.set(producerData.producerId, {
                stream: screenStream,
                producerId: producerData.producerId,
                userId: userId,
                userName: producerData.appData?.userName || 'Unknown',
                socketId: socketId
              });
              
              set({ remoteScreenShares: newRemoteScreenShares });
            } else if (producerData.kind === 'audio') {
              console.log('Screen share audio producer detected, creating audio element');
              
              // Создаем audio element для screen share audio
              const audioElement = document.createElement('audio');
              audioElement.srcObject = new MediaStream([consumer.track]);
              audioElement.autoplay = true;
              audioElement.volume = 1.0; // Полная громкость для screen share audio
              audioElement.muted = false;
              audioElement.playsInline = true;
              audioElement.controls = false;
              audioElement.style.display = 'none';
              
              // Добавляем в DOM для воспроизведения
              document.body.appendChild(audioElement);
              
              // Сохраняем audio element для screen share audio
              const screenShareAudioKey = `screen-share-audio-${userId}`;
              const currentState = get();
              const newAudioElements = new Map(currentState.audioElements);
              newAudioElements.set(screenShareAudioKey, audioElement);
              
              set({ audioElements: newAudioElements });
              
              console.log('Screen share audio element created:', screenShareAudioKey);
            }
            
            return;
          }

          // Обработка video producers (вебкамера)
          if (producerData.kind === 'video' && producerData.appData?.mediaType === 'camera') {
            console.log('🎥 Camera video producer detected, updating participant video stream');
            console.log('🎥 Producer data:', { userId, producerUserId: producerData.appData?.userId, currentUserId: state.currentUserId });
            
            // Проверяем, есть ли уже videoStream у участника
            const existingParticipant = state.participants.find(p => p.userId === userId);
            if (existingParticipant && existingParticipant.videoStream) {
              console.log('🎥 Participant already has video stream, skipping creation');
              return;
            }
            
            // Создаем MediaStream из consumer track
            const videoStream = new MediaStream([consumer.track]);
            console.log('🎥 Created video stream:', videoStream);
            
            // Обновляем участника с video stream
            set((state) => {
              const updatedParticipants = state.participants.map(p => 
                p.userId === userId 
                  ? { ...p, isVideoEnabled: true, videoStream: videoStream }
                  : p
              );
              console.log('🎥 Updated participants:', updatedParticipants);
              return { participants: updatedParticipants };
            });
            
            return;
          }
          
          // Инициализируем AudioContext если еще не создан
          let audioContext = state.audioContext;
          if (!audioContext || audioContext.state === 'closed') {
            audioContext = new (window.AudioContext || window.webkitAudioContext)({
              sampleRate: 48000,
              latencyHint: 'interactive'
            });
            set({ audioContext });
          }
          
          if (audioContext.state === 'suspended') {
            await audioContext.resume();
          }
          
          // Создаем audio element
          const audioElement = document.createElement('audio');
          audioElement.srcObject = new MediaStream([consumer.track]);
          audioElement.autoplay = true;
          audioElement.playsInline = true;
          audioElement.controls = false;
          audioElement.style.display = 'none';
          document.body.appendChild(audioElement);
          
          // Создаем Web Audio API chain
          const source = audioContext.createMediaStreamSource(new MediaStream([consumer.track]));
          const gainNode = audioContext.createGain();
          source.connect(gainNode);
          
          // Устанавливаем начальную громкость
          const initialVolume = state.userVolumes.get(userId) || 100;
          const isMuted = state.userMutedStates.get(userId) || false;
          const audioVolume = state.isGlobalAudioMuted ? 0 : (isMuted ? 0 : (initialVolume / 100.0));
          audioElement.volume = audioVolume;
          
          // Сохраняем ссылки
          set((state) => {
            const newGainNodes = new Map(state.gainNodes);
            const newAudioElements = new Map(state.audioElements);
            newGainNodes.set(userId, gainNode);
            newAudioElements.set(userId, audioElement);
            
            const newUserVolumes = new Map(state.userVolumes);
            if (!newUserVolumes.has(userId)) {
              newUserVolumes.set(userId, 100);
            }
            
            return {
              gainNodes: newGainNodes,
              audioElements: newAudioElements,
              userVolumes: newUserVolumes
            };
          });

          try {
            await audioElement.play();
            console.log('Audio playback started for peer:', userId);
            set({ audioBlocked: false });
          } catch (error) {
            console.log('Auto-play blocked, user interaction required:', error);
            set({ audioBlocked: true });
            setTimeout(async () => {
              try {
                await audioElement.play();
                set({ audioBlocked: false });
              } catch {
                console.log('Audio playback still blocked');
              }
            }, 1000);
          }

          await voiceCallApi.resumeConsumer(consumerData.id);
          console.log('New consumer created:', consumerData.id);
        } catch (error) {
          console.error('Failed to handle new producer:', error);
        }
      },
      
      // Создание аудио потока
      createAudioStream: async () => {
        try {
          const state = get();
          if (!state.sendTransport) return;
          
          // Закрываем старые producers
          if (state.producers.size > 0) {
            state.producers.forEach(producer => {
              try {
                producer.close();
              } catch (e) {
                console.warn('Error closing producer:', e);
              }
            });
            set({ producers: new Map() });
          }
          
          // Останавливаем старый поток если есть
          if (state.localStream) {
            state.localStream.getTracks().forEach(track => track.stop());
          }
          
          // Очищаем старое шумоподавление
          if (state.noiseSuppressionManager) {
            state.noiseSuppressionManager.cleanup();
          }
          
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
              sampleRate: 48000,
              channelCount: 1,
              latency: 0,
              suppressLocalAudioPlayback: true
            }
          });

          set({ localStream: stream, audioStream: stream });
          
          // Инициализация audio context
          let audioContext = state.audioContext;
          if (!audioContext || audioContext.state === 'closed') {
            audioContext = new (window.AudioContext || window.webkitAudioContext)({
              sampleRate: 48000,
              latencyHint: 'interactive'
            });
            set({ audioContext });
          }
          
          if (audioContext.state === 'suspended') {
            await audioContext.resume();
          }
          
          // Инициализация шумоподавления
          const noiseSuppressionManager = new NoiseSuppressionManager();
          await noiseSuppressionManager.initialize(stream, audioContext);
          set({ noiseSuppressionManager });
          
          // Получаем обработанный поток
          const processedStream = noiseSuppressionManager.getProcessedStream();
          const audioTrack = processedStream.getAudioTracks()[0];
          
          if (!audioTrack) {
            throw new Error('No audio track in processed stream');
          }
          
          // Применяем шумоподавление если оно было включено
          if (state.isNoiseSuppressed) {
            await noiseSuppressionManager.enable(state.noiseSuppressionMode);
          }
          
          // Устанавливаем состояние микрофона
          audioTrack.enabled = !state.isMuted;
          
          const producer = await state.sendTransport.produce({
            track: audioTrack,
            appData: { userId: state.currentUserId, userName: state.currentUserName }
          });

          set((state) => {
            const newProducers = new Map(state.producers);
            newProducers.set(producer.id, producer);
            return { producers: newProducers };
          });
          
          // Устанавливаем producer в noise suppression manager
          noiseSuppressionManager.setProducer(producer);
          
          console.log('Audio stream created with noise suppression support');
          return producer;
        } catch (error) {
          console.error('Failed to create audio stream:', error);
          set({ error: error.message });
        }
      },
      
      // Переключение микрофона
      toggleMute: () => {
        const state = get();
        const newMutedState = !state.isMuted;
        
        if (state.noiseSuppressionManager) {
          const processedStream = state.noiseSuppressionManager.getProcessedStream();
          const audioTrack = processedStream?.getAudioTracks()[0];
          if (audioTrack) {
            audioTrack.enabled = !newMutedState;
          }
        } else if (state.localStream) {
          const audioTrack = state.localStream.getAudioTracks()[0];
          if (audioTrack) {
            audioTrack.enabled = !newMutedState;
          }
        }
        
        // Отправляем состояние мута на сервер
        if (voiceCallApi.socket) {
          voiceCallApi.socket.emit('muteState', { isMuted: newMutedState });
        }
        
        set({ isMuted: newMutedState });
      },
      
      // Переключение мута для отдельного пользователя
      toggleUserMute: (peerId) => {
        const state = get();
        const audioElement = state.audioElements.get(peerId);
        if (!audioElement) return;

        const isCurrentlyMuted = state.userMutedStates.get(peerId) || false;
        const newIsMuted = !isCurrentlyMuted;

        if (newIsMuted) {
          const currentVolume = state.userVolumes.get(peerId) || 100;
          set((state) => {
            const newPreviousVolumes = new Map(state.previousVolumes);
            newPreviousVolumes.set(peerId, currentVolume);
            return { previousVolumes: newPreviousVolumes };
          });
          audioElement.volume = 0;
        } else {
          const currentVolume = state.userVolumes.get(peerId) || 100;
          const audioVolume = state.isGlobalAudioMuted ? 0 : (currentVolume / 100.0);
          audioElement.volume = audioVolume;
        }

        set((state) => {
          const newUserMutedStates = new Map(state.userMutedStates);
          newUserMutedStates.set(peerId, newIsMuted);
          return { userMutedStates: newUserMutedStates };
        });
      },
      
      // Изменение громкости отдельного пользователя
      changeUserVolume: (peerId, newVolume) => {
        const state = get();
        const audioElement = state.audioElements.get(peerId);
        if (!audioElement) return;

        const audioVolume = state.isGlobalAudioMuted ? 0 : (newVolume / 100.0);
        audioElement.volume = audioVolume;

        set((state) => {
          const newUserVolumes = new Map(state.userVolumes);
          newUserVolumes.set(peerId, newVolume);
          return { userVolumes: newUserVolumes };
        });

        // Если размутиваем через слайдер, обновляем состояние мута
        if (newVolume > 0 && state.userMutedStates.get(peerId)) {
          set((state) => {
            const newUserMutedStates = new Map(state.userMutedStates);
            newUserMutedStates.set(peerId, false);
            return { userMutedStates: newUserMutedStates };
          });
        } else if (newVolume === 0 && !state.userMutedStates.get(peerId)) {
          set((state) => {
            const newUserMutedStates = new Map(state.userMutedStates);
            newUserMutedStates.set(peerId, true);
            return { userMutedStates: newUserMutedStates };
          });
        }
      },
      
      // Переключение отображения слайдера громкости
      toggleVolumeSlider: (peerId) => {
        set((state) => {
          const newShowVolumeSliders = new Map(state.showVolumeSliders);
          const currentState = newShowVolumeSliders.get(peerId) || false;
          newShowVolumeSliders.set(peerId, !currentState);
          return { showVolumeSliders: newShowVolumeSliders };
        });
      },
      
      // Глобальное отключение/включение звука всех участников
      toggleGlobalAudio: () => {
        const state = get();
        const newMutedState = !state.isGlobalAudioMuted;
        
        // Отправляем состояние наушников на сервер (как в старом клиенте)
        if (voiceCallApi.socket) {
          const audioStateData = { 
            isEnabled: !newMutedState,
            isGlobalAudioMuted: newMutedState,
            userId: get().currentUserId
          };
          console.log('Sending audioState to server:', audioStateData);
          voiceCallApi.socket.emit('audioState', audioStateData);
        }
        
        // Обновляем isAudioEnabled в соответствии с глобальным звуком
        set({ isGlobalAudioMuted: newMutedState, isAudioEnabled: !newMutedState });
        
        // Также обновляем локального пользователя в списке участников
        set((state) => ({
          participants: state.participants.map(p => {
            if (p.userId === state.currentUserId) {
              return { ...p, isGlobalAudioMuted: newMutedState, isAudioEnabled: !newMutedState };
            }
            return p;
          })
        }));
        
        // Также отправляем отдельное событие для глобального звука
        if (voiceCallApi.socket) {
          console.log('Sending globalAudioState to server:', { 
            userId: state.currentUserId,
            isGlobalAudioMuted: newMutedState 
          });
          voiceCallApi.socket.emit('globalAudioState', { 
            userId: state.currentUserId,
            isGlobalAudioMuted: newMutedState 
          });
        }
        
        // Управляем HTML Audio элементами
        state.audioElements.forEach((audioElement, peerId) => {
          if (audioElement) {
            if (newMutedState) {
              audioElement.volume = 0;
            } else {
              const volume = state.userVolumes.get(peerId) || 100;
              const isIndividuallyMuted = state.userMutedStates.get(peerId) || false;
              const audioVolume = isIndividuallyMuted ? 0 : (volume / 100.0);
              audioElement.volume = audioVolume;
            }
          }
        });
      },
      
      // Переключение шумоподавления
      toggleNoiseSuppression: async () => {
        try {
          const state = get();
          if (!state.noiseSuppressionManager || !state.noiseSuppressionManager.isInitialized()) {
            console.error('Noise suppression not initialized');
            return false;
          }

          const newState = !state.isNoiseSuppressed;
          let success = false;

          if (newState) {
            success = await state.noiseSuppressionManager.enable(state.noiseSuppressionMode);
          } else {
            success = await state.noiseSuppressionManager.disable();
          }

          if (success) {
            set({ isNoiseSuppressed: newState });
            localStorage.setItem('noiseSuppression', JSON.stringify(newState));
            
            // Обновляем состояние микрофона для обработанного трека
            if (state.noiseSuppressionManager) {
              const processedStream = state.noiseSuppressionManager.getProcessedStream();
              const audioTrack = processedStream?.getAudioTracks()[0];
              if (audioTrack) {
                audioTrack.enabled = !state.isMuted;
              }
            }
            
            return true;
          }
          
          return false;
        } catch (error) {
          console.error('Error toggling noise suppression:', error);
          return false;
        }
      },
      
      // Изменение режима шумоподавления
      changeNoiseSuppressionMode: async (mode) => {
        try {
          const state = get();
          if (!state.noiseSuppressionManager || !state.noiseSuppressionManager.isInitialized()) {
            console.error('Noise suppression not initialized');
            return false;
          }

          let success = false;

          if (!state.isNoiseSuppressed) {
            success = await state.noiseSuppressionManager.enable(mode);
          } else if (mode !== state.noiseSuppressionMode) {
            success = await state.noiseSuppressionManager.enable(mode);
          } else {
            return true; // Режим уже установлен
          }

          if (success) {
            set({ noiseSuppressionMode: mode, isNoiseSuppressed: true });
            localStorage.setItem('noiseSuppression', JSON.stringify(true));
            
            // Обновляем состояние микрофона для обработанного трека
            if (state.noiseSuppressionManager) {
              const processedStream = state.noiseSuppressionManager.getProcessedStream();
              const audioTrack = processedStream?.getAudioTracks()[0];
              if (audioTrack) {
                audioTrack.enabled = !state.isMuted;
              }
            }
            
            return true;
          }
          
          return false;
        } catch (error) {
          console.error('Error changing noise suppression mode:', error);
          return false;
        }
      },
      
      // Завершение звонка
      endCall: async () => {
        try {
          const state = get();
          
          // Очищаем обработчики событий
          voiceCallApi.off('peerJoined');
          voiceCallApi.off('peerLeft');
          voiceCallApi.off('peerMuteStateChanged');
          voiceCallApi.off('peerAudioStateChanged');
          voiceCallApi.off('newProducer');
          voiceCallApi.off('producerClosed');
          voiceCallApi.off('globalAudioStateChanged');
          
          // Очищаем socket обработчики
          if (voiceCallApi.socket) {
            voiceCallApi.socket.off('globalAudioState');
          }
          
          if (state.localStream) {
            state.localStream.getTracks().forEach(track => track.stop());
          }
          
          // Очистка шумоподавления
          if (state.noiseSuppressionManager) {
            state.noiseSuppressionManager.cleanup();
          }
          
          // Закрытие audio context
          if (state.audioContext && state.audioContext.state !== 'closed') {
            await state.audioContext.close();
          }
          
          if (state.sendTransport) {
            state.sendTransport.close();
          }
          
          if (state.recvTransport) {
            state.recvTransport.close();
          }
          
          state.consumers.forEach(consumer => consumer.close());
          state.producers.forEach(producer => producer.close());
          
          // Очистка GainNodes и audio elements
          state.gainNodes.forEach(gainNode => {
            try {
              gainNode.disconnect();
            } catch (e) {
              console.warn('Error disconnecting gain node:', e);
            }
          });
          
          state.audioElements.forEach(audioElement => {
            try {
              audioElement.pause();
              audioElement.srcObject = null;
              if (audioElement.parentNode) {
                audioElement.parentNode.removeChild(audioElement);
              }
            } catch (e) {
              console.warn('Error removing audio element:', e);
            }
          });
          
          await voiceCallApi.disconnect();
          
          set({
            isConnected: false,
            isInCall: false,
            currentRoomId: null,
            currentCall: null,
            participants: [],
            userVolumes: new Map(),
            userMutedStates: new Map(),
            showVolumeSliders: new Map(),
            gainNodes: new Map(),
            audioElements: new Map(),
            previousVolumes: new Map(),
            peerIdToUserIdMap: new Map(),
            device: null,
            sendTransport: null,
            recvTransport: null,
            producers: new Map(),
            consumers: new Map(),
            localStream: null,
            noiseSuppressionManager: null,
            audioContext: null,
            connecting: false
          });
          
          console.log('Call ended successfully');
        } catch (error) {
          console.error('Failed to end call:', error);
          set({ error: error.message });
        }
      },
      
      // Демонстрация экрана
      startScreenShare: async () => {
        try {
          const state = get();
          if (!state.sendTransport) {
            throw new Error('Transport not ready');
          }

          // Останавливаем существующую демонстрацию экрана, если есть
          if (state.isScreenSharing) {
            await get().stopScreenShare();
          }

          console.log('Requesting screen sharing access...');
          const stream = await navigator.mediaDevices.getDisplayMedia({
            video: {
              cursor: 'always',
              frameRate: { ideal: 60, max: 60 },
              width: { ideal: 1920, max: 1920 },
              height: { ideal: 1080, max: 1080 },
              aspectRatio: 16/9,
              displaySurface: 'monitor',
              resizeMode: 'crop-and-scale'
            },
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
              sampleRate: 48000,
              channelCount: 2,
              sampleSize: 16
            }
          });

          console.log('Screen sharing access granted');

          // Обработка остановки потока пользователем
          stream.getVideoTracks()[0].onended = () => {
            console.log('Screen sharing stopped by user');
            get().stopScreenShare();
          };

          // Устанавливаем поток
          set({ screenShareStream: stream });

          const videoTrack = stream.getVideoTracks()[0];
          if (!videoTrack) {
            throw new Error('No video track available');
          }

          console.log('Creating screen sharing producer...');
          const videoProducer = await state.sendTransport.produce({
            track: videoTrack,
            encodings: [
              {
                scaleResolutionDownBy: 1,
                maxBitrate: 5000000, // 5 Mbps для Full HD
                maxFramerate: 60
              }
            ],
            codecOptions: {
              videoGoogleStartBitrate: 3000, // Начальный битрейт 3 Mbps
              videoGoogleMaxBitrate: 5000 // Максимальный битрейт 5 Mbps
            },
            appData: {
              mediaType: 'screen',
              trackType: 'video',
              userId: state.currentUserId,
              userName: state.currentUserName,
              width: videoTrack.getSettings().width,
              height: videoTrack.getSettings().height,
              frameRate: videoTrack.getSettings().frameRate
            }
          });

          console.log('Screen sharing video producer created:', videoProducer.id);

          // Создаем отдельный audio producer для демонстрации экрана
          const audioTrack = stream.getAudioTracks()[0];
          let audioProducer = null;
          
          if (audioTrack) {
            console.log('Creating screen sharing audio producer...');
            audioProducer = await state.sendTransport.produce({
              track: audioTrack,
              appData: {
                mediaType: 'screen',
                trackType: 'audio',
                userId: state.currentUserId,
                userName: state.currentUserName
              }
            });
            console.log('Screen sharing audio producer created:', audioProducer.id);
          } else {
            console.log('No audio track in screen share stream');
          }

          // Сохраняем producers
          const newProducers = new Map(state.producers);
          newProducers.set('screen-video', videoProducer);
          if (audioProducer) {
            newProducers.set('screen-audio', audioProducer);
          }
          set({ 
            producers: newProducers,
            isScreenSharing: true 
          });

          // Обработка событий video producer
          videoProducer.on('transportclose', () => {
            console.log('Screen sharing video transport closed');
            get().stopScreenShare();
          });

          videoProducer.on('trackended', () => {
            console.log('Screen sharing track ended');
            get().stopScreenShare();
          });

        } catch (error) {
          console.error('Error starting screen share:', error);
          // Очищаем при ошибке
          const currentState = get();
          if (currentState.screenShareStream) {
            currentState.screenShareStream.getTracks().forEach(track => track.stop());
          }
          set({ 
            screenShareStream: null,
            isScreenSharing: false,
            error: 'Failed to start screen sharing: ' + error.message 
          });
        }
      },

      stopScreenShare: async () => {
        console.log('Stopping screen sharing...');

        try {
          const state = get();
          // Уведомляем сервер об остановке демонстрации экрана
          const videoProducer = state.producers.get('screen-video');
          
          if (videoProducer && voiceCallApi.socket) {
            try {
              await voiceCallApi.stopScreenSharing(videoProducer.id);
            } catch (error) {
              console.log('stopScreenShare: voiceCallApi.stopScreenSharing failed:', error.message);
              // Продолжаем выполнение даже если сервер не ответил
            }
          }

          // Останавливаем поток
          if (state.screenShareStream) {
            state.screenShareStream.getTracks().forEach(track => track.stop());
          }

          // Удаляем producers
          const newProducers = new Map(state.producers);
          newProducers.delete('screen-video');
          newProducers.delete('screen-audio');

          // Очищаем screen share audio elements
          const newAudioElements = new Map(state.audioElements);
          for (const [key, audioElement] of newAudioElements.entries()) {
            if (key.startsWith('screen-share-audio-')) {
              try {
                audioElement.pause();
                audioElement.srcObject = null;
                if (audioElement.parentNode) {
                  audioElement.parentNode.removeChild(audioElement);
                }
                newAudioElements.delete(key);
                console.log('Removed screen share audio element:', key);
              } catch (e) {
                console.warn('Error removing screen share audio element:', e);
              }
            }
          }

          // Очищаем состояние
          set({
            screenShareStream: null,
            isScreenSharing: false,
            producers: newProducers,
            audioElements: newAudioElements
          });

          console.log('Screen sharing stopped successfully');
        } catch (error) {
          console.error('Error stopping screen share:', error);
          set({ error: 'Failed to stop screen sharing: ' + error.message });
        }
      },

      toggleScreenShare: async () => {
        console.log('toggleScreenShare called');
        const state = get();
        console.log('Current state:', { isScreenSharing: state.isScreenSharing, sendTransport: !!state.sendTransport });
        if (state.isScreenSharing) {
          console.log('Stopping screen share...');
          await get().stopScreenShare();
          console.log('After stopScreenShare, state:', { 
            isScreenSharing: get().isScreenSharing, 
            screenShareStream: get().screenShareStream 
          });
        } else {
          console.log('Starting screen share...');
          await get().startScreenShare();
        }
      },

      // Включение/выключение вебкамеры
      toggleVideo: async () => {
        console.log('🎥🎥🎥 toggleVideo called in callStore');
        const state = get();
        console.log('🎥 Current state:', { isVideoEnabled: state.isVideoEnabled, sendTransport: !!state.sendTransport });
        if (state.isVideoEnabled) {
          console.log('🎥 Stopping video...');
          await get().stopVideo();
        } else {
          console.log('🎥 Starting video...');
          await get().startVideo();
        }
      },

      // Включение вебкамеры
      startVideo: async () => {
        console.log('🎥🎥🎥 startVideo called');
        try {
          const state = get();
          console.log('🎥 startVideo state check:', { sendTransport: !!state.sendTransport, currentUserId: state.currentUserId });
          if (!state.sendTransport) {
            throw new Error('Send transport not available');
          }

          console.log('Requesting camera access...');
          const cameraStream = await navigator.mediaDevices.getUserMedia({
            video: {
              width: { ideal: 1280, max: 1920 },
              height: { ideal: 720, max: 1080 },
              frameRate: { ideal: 30, max: 60 },
              facingMode: 'user'
            },
            audio: false // Явно отключаем аудио для вебкамеры
          });

          console.log('Camera access granted');
          set({ cameraStream: cameraStream, isVideoEnabled: true });

          const videoTrack = cameraStream.getVideoTracks()[0];
          if (!videoTrack) {
            throw new Error('No video track available');
          }

          console.log('Creating video producer...');
          const videoProducer = await state.sendTransport.produce({
            track: videoTrack,
            encodings: [
              {
                scaleResolutionDownBy: 1,
                maxBitrate: 2500000, // 2.5 Mbps для HD
                maxFramerate: 30
              }
            ],
            codecOptions: {
              videoGoogleStartBitrate: 1500,
              videoGoogleMaxBitrate: 2500
            },
            appData: {
              mediaType: 'camera',
              trackType: 'video',
              userId: state.currentUserId,
              userName: state.currentUserName
            }
          });

          console.log('Video producer created:', videoProducer.id);
          set({ videoProducer });

          // Обработка событий video producer
          videoProducer.on('transportclose', () => {
            console.log('Video transport closed');
            get().stopVideo();
          });

          videoProducer.on('trackended', () => {
            console.log('Video track ended');
            get().stopVideo();
          });

        } catch (error) {
          console.error('Error starting video:', error);
          set({ error: 'Failed to start video: ' + error.message });
        }
      },

      // Выключение вебкамеры
      stopVideo: async () => {
        console.log('🎥🎥🎥 STOP VIDEO START 🎥🎥🎥');
        try {
          const state = get();
          console.log('🎥 Current state before stop:', {
            isVideoEnabled: state.isVideoEnabled,
            hasVideoProducer: !!state.videoProducer,
            hasCameraStream: !!state.cameraStream,
            hasAudioStream: !!state.audioStream,
            hasLocalStream: !!state.localStream,
            producersCount: state.producers.size,
            producersKeys: Array.from(state.producers.keys())
          });
          
          // Останавливаем video producer
          if (state.videoProducer) {
            try {
              console.log('🎥 Closing video producer:', state.videoProducer.id);
              console.log('🎥 Sending stopVideo event to server:', {
                producerId: state.videoProducer.id
              });
              
              // Отправляем событие на сервер
              await voiceCallApi.stopVideo(state.videoProducer.id);
              
              await state.videoProducer.close();
              console.log('🎥 Video producer closed successfully');
            } catch (error) {
              console.log('🎥 stopVideo: videoProducer.close failed:', error.message);
            }
          } else {
            console.log('🎥 No video producer to close');
          }

          // Останавливаем поток вебкамеры (он содержит только видео треки)
          if (state.cameraStream) {
            console.log('🎥 Stopping camera stream tracks');
            const tracks = state.cameraStream.getTracks();
            console.log('🎥 Camera stream tracks count:', tracks.length);
            tracks.forEach(track => {
              console.log('🎥 Stopping camera track:', track.label, 'kind:', track.kind, 'enabled:', track.enabled);
              track.stop();
            });
            console.log('🎥 Camera stream tracks stopped');
          } else {
            console.log('🎥 No camera stream to stop');
          }

          // Очищаем состояние вебкамеры
          console.log('🎥 Clearing video state...');
          set({
            isVideoEnabled: false,
            videoProducer: null,
            cameraStream: null
          });
          console.log('🎥 Video state cleared');
          
          console.log('🎥 Video stopped, but audio should continue working');
          
          // Проверяем, что основной аудио producer не затронут
          const currentState = get();
          console.log('🎥 Final state after stop:', {
            isVideoEnabled: currentState.isVideoEnabled,
            hasVideoProducer: !!currentState.videoProducer,
            hasCameraStream: !!currentState.cameraStream,
            hasAudioStream: !!currentState.audioStream,
            hasLocalStream: !!currentState.localStream,
            producersCount: currentState.producers.size,
            producersKeys: Array.from(currentState.producers.keys())
          });
          
          console.log('🎥 Remaining producers after video stop:', Array.from(currentState.producers.keys()));
          console.log('🎥 Audio context state:', currentState.audioContext?.state);
          console.log('🎥 Camera stream state:', currentState.cameraStream ? 'exists' : 'null');
          console.log('🎥 Is video enabled:', currentState.isVideoEnabled);
          
          // Проверяем, есть ли активные аудио треки в основном потоке
          if (currentState.audioStream) {
            const audioTracks = currentState.audioStream.getAudioTracks();
            console.log('🎥 Main audio stream tracks:', audioTracks.length);
            audioTracks.forEach(track => {
              console.log('🎥 Main audio track:', track.label, 'enabled:', track.enabled, 'readyState:', track.readyState);
            });
          } else {
            console.log('🎥 Main audio stream: null');
          }

          // Проверяем localStream
          if (currentState.localStream) {
            const localTracks = currentState.localStream.getTracks();
            console.log('🎥 Local stream tracks:', localTracks.length);
            localTracks.forEach(track => {
              console.log('🎥 Local track:', track.label, 'kind:', track.kind, 'enabled:', track.enabled, 'readyState:', track.readyState);
            });
          } else {
            console.log('🎥 Local stream: null');
          }

          console.log('🎥🎥🎥 STOP VIDEO END 🎥🎥🎥');
          console.log('Video stopped successfully');
        } catch (error) {
          console.error('Error stopping video:', error);
          set({ error: 'Failed to stop video: ' + error.message });
        }
      }
    }),
    {
      name: 'call-store',
    }
  )
);
