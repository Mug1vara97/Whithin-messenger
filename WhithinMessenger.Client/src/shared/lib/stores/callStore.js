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
      
      // Состояние аудио
      isMuted: false,
      isAudioEnabled: true, // Добавляем isAudioEnabled
      isGlobalAudioMuted: false,
      isNoiseSuppressed: false,
      noiseSuppressionMode: 'rnnoise',
      userVolumes: new Map(),
      userMutedStates: new Map(),
      showVolumeSliders: new Map(),
      
      // Состояние демонстрации экрана
      isScreenSharing: false,
      screenShareStream: null,
      
      // Состояние ошибок
      error: null,
      audioBlocked: false,
      
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
            const producerId = data.producerId || data;
            const producerSocketId = data.producerSocketId;
            
            const consumer = get().consumers.get(producerId);
            if (consumer) {
              consumer.close();
              set((state) => {
                const newConsumers = new Map(state.consumers);
                newConsumers.delete(producerId);
                return { consumers: newConsumers };
              });
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
          
          set({ isConnected: true, connecting: false });
          
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

          set({ localStream: stream });
          
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
      
      // Методы для демонстрации экрана
      startScreenShare: async () => {
        try {
          console.log('Starting screen share...');
          
          // Запрашиваем доступ к экрану
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
            audio: false // Демонстрация экрана без звука
          });

          set({ screenShareStream: stream, isScreenSharing: true });

          // Создаем producer для демонстрации экрана
          const videoTrack = stream.getVideoTracks()[0];
          if (!videoTrack) {
            throw new Error('No video track found in screen share stream');
          }

          // Создаем transport для демонстрации экрана через mediasoup Device
          const transportParams = await voiceCallApi.createWebRtcTransport();
          if (!transportParams) {
            throw new Error('Failed to create transport for screen share');
          }

          // Создаем mediasoup transport напрямую, как в старом клиенте
          const transport = voiceCallApi.device.createSendTransport({
            ...transportParams,
            iceServers: [
              { urls: 'stun:stun.l.google.com:19302' },
              { urls: 'stun:stun1.l.google.com:19302' }
            ],
            iceTransportPolicy: 'all',
            iceCandidatePoolSize: 10
          });

          // Добавляем обработчики событий transport, как в старом клиенте
          transport.on('connect', async ({ dtlsParameters }, callback, errback) => {
            try {
              console.log('Screen share transport connect event');
              await voiceCallApi.connectTransport(transport.id, dtlsParameters);
              callback();
            } catch (error) {
              console.error('Screen share transport connect error:', error);
              errback(error);
            }
          });

          transport.on('produce', async ({ kind, rtpParameters, appData }, callback, errback) => {
            try {
              console.log('Screen share transport produce event');
              const response = await voiceCallApi.produce({
                transportId: transport.id,
                kind,
                rtpParameters,
                appData
              });
              callback({ id: response.id });
            } catch (error) {
              console.error('Screen share transport produce error:', error);
              errback(error);
            }
          });

          // Создаем producer напрямую через transport, как в старом клиенте
          const state = get();
          const producer = await transport.produce({
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
              userId: state.currentUserId,
              userName: state.currentUserName,
              width: videoTrack.getSettings().width,
              height: videoTrack.getSettings().height,
              frameRate: videoTrack.getSettings().frameRate
            }
          });

          if (!producer) {
            throw new Error('Failed to create screen share producer');
          }

          // Сохраняем producer для демонстрации экрана
          const newProducers = new Map(state.producers);
          newProducers.set('screen', producer);
          set({ producers: newProducers });

          // Обработчик завершения демонстрации экрана
          stream.getVideoTracks()[0].onended = () => {
            console.log('Screen share ended by user');
            get().stopScreenShare();
          };

          console.log('Screen share started successfully');
          return true;
        } catch (error) {
          console.error('Failed to start screen share:', error);
          set({ error: `Ошибка демонстрации экрана: ${error.message}` });
          return false;
        }
      },

      stopScreenShare: async () => {
        try {
          console.log('Stopping screen share...');
          const state = get();
          
          // Останавливаем поток
          if (state.screenShareStream) {
            state.screenShareStream.getTracks().forEach(track => track.stop());
          }

          // Закрываем producer
          const screenProducer = state.producers.get('screen');
          if (screenProducer) {
            await voiceCallApi.stopScreenSharing(screenProducer.id);
            const newProducers = new Map(state.producers);
            newProducers.delete('screen');
            set({ producers: newProducers });
          }

          set({ isScreenSharing: false, screenShareStream: null });
          console.log('Screen share stopped successfully');
          return true;
        } catch (error) {
          console.error('Failed to stop screen share:', error);
          set({ error: `Ошибка остановки демонстрации экрана: ${error.message}` });
          return false;
        }
      },

      toggleScreenShare: async () => {
        const state = get();
        if (state.isScreenSharing) {
          return await get().stopScreenShare();
        } else {
          return await get().startScreenShare();
        }
      }
    }),
    {
      name: 'call-store',
    }
  )
);
