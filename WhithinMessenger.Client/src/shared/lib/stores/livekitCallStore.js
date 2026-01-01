import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { livekitApi } from '../../../entities/voice-call/api/livekitApi';
import { NoiseSuppressionManager } from '../utils/noiseSuppression';
import { audioNotificationManager } from '../utils/audioNotifications';
import { getAudioDeviceManager } from '../utils/audioDeviceManager';
import { Room, RoomEvent, Track, TrackPublication, RemoteParticipant, LocalParticipant } from 'livekit-client';

export const useLiveKitCallStore = create(
  devtools(
    (set, get) => ({
      // Состояние звонка
      isConnected: false,
      isInCall: false,
      currentRoomId: null,
      currentUserId: null,
      currentUserName: null,
      currentCall: null,
      room: null, // LiveKit Room объект
      
      // Состояние участников
      participants: [],
      speakingUsers: new Set(),
      
      // Отдельные состояния для оптимизации
      participantMuteStates: new Map(),
      participantAudioStates: new Map(),
      participantGlobalAudioStates: new Map(),
      participantVideoStates: new Map(),
      
      // Состояние аудио
      isMuted: (() => {
        try {
          const saved = localStorage.getItem('micMuted');
          return saved ? JSON.parse(saved) : false;
        } catch {
          return false;
        }
      })(),
      isAudioEnabled: (() => {
        try {
          const saved = localStorage.getItem('audioMuted');
          return saved ? !JSON.parse(saved) : true;
        } catch {
          return true;
        }
      })(),
      isGlobalAudioMuted: (() => {
        try {
          const saved = localStorage.getItem('audioMuted');
          return saved ? JSON.parse(saved) : false;
        } catch {
          return false;
        }
      })(),
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
      cameraStream: null,
      
      // WebRTC соединения
      localStream: null,
      noiseSuppressionManager: null,
      audioContext: null,
      gainNodes: new Map(),
      audioElements: new Map(),
      previousVolumes: new Map(),
      voiceDetectorNodes: new Map(),
      voiceDetectorSources: new Map(),
      voiceWorkletLoaded: false,
      
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
          await audioNotificationManager.initialize();
          
          // Очищаем старые обработчики
          livekitApi.off('peerJoined');
          livekitApi.off('peerLeft');
          livekitApi.off('peerMuteStateChanged');
          livekitApi.off('peerAudioStateChanged');
          livekitApi.off('newProducer');
          livekitApi.off('producerClosed');
          
          await livekitApi.connect(userId, userName);
          
          // Регистрируем обработчики событий
          livekitApi.on('peerJoined', (peerData) => {
            console.log('Peer joined:', peerData);
            set((state) => ({
              participants: [...state.participants.filter(p => p.userId !== peerData.userId), {
                userId: peerData.userId,
                name: peerData.name,
                isMuted: peerData.isMuted || false,
                isAudioEnabled: peerData.isAudioEnabled !== undefined ? peerData.isAudioEnabled : true,
                isGlobalAudioMuted: peerData.isGlobalAudioMuted || false,
                isSpeaking: false
              }]
            }));
            audioNotificationManager.playUserJoinedSound().catch(console.warn);
          });

          livekitApi.on('peerLeft', (peerData) => {
            console.log('Peer left:', peerData);
            const userId = peerData.userId;
            
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
                previousVolumes: newPreviousVolumes,
                participants: state.participants.filter(p => p.userId !== userId)
              };
            });
            
            audioNotificationManager.playUserLeftSound().catch(console.warn);
          });

          livekitApi.on('peerMuteStateChanged', ({ userId, isMuted }) => {
            set((state) => {
              const newMuteStates = new Map(state.participantMuteStates);
              newMuteStates.set(userId, isMuted);
              return { participantMuteStates: newMuteStates };
            });
            
            set((state) => ({
              participants: state.participants.map(p => 
                p.userId === userId ? { ...p, isMuted, isSpeaking: isMuted ? false : p.isSpeaking } : p
              )
            }));
          });

          livekitApi.on('peerAudioStateChanged', (data) => {
            const { userId, isAudioEnabled, isGlobalAudioMuted } = data;
            
            set((state) => {
              const newAudioStates = new Map(state.participantAudioStates);
              newAudioStates.set(userId, Boolean(isAudioEnabled));
              
              const newGlobalAudioStates = new Map(state.participantGlobalAudioStates);
              if (isGlobalAudioMuted !== undefined) {
                newGlobalAudioStates.set(userId, isGlobalAudioMuted);
              }
              
              return {
                participantAudioStates: newAudioStates,
                participantGlobalAudioStates: newGlobalAudioStates
              };
            });
            
            set((state) => ({
              participants: state.participants.map(p => {
                if (p.userId === userId) {
                  const updated = { ...p, isAudioEnabled: Boolean(isAudioEnabled) };
                  if (isGlobalAudioMuted !== undefined) {
                    updated.isGlobalAudioMuted = isGlobalAudioMuted;
                  }
                  return updated;
                }
                return p;
              })
            }));
          });

          livekitApi.on('newProducer', async (producerData) => {
            await get().handleNewTrack(producerData);
          });

          livekitApi.on('producerClosed', (data) => {
            get().handleTrackRemoved(data);
          });
          
          set({ isConnected: true, connecting: false });
          
          // Отправляем начальные состояния
          livekitApi.sendMuteState(get().isMuted);
          livekitApi.sendAudioState(!get().isGlobalAudioMuted, get().isGlobalAudioMuted);
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
          const response = await livekitApi.joinRoom(
            roomId, 
            state.currentUserName, 
            state.currentUserId,
            state.isMuted,
            !state.isGlobalAudioMuted
          );
          
          const room = response.room;
          set({ room, currentRoomId: roomId, isInCall: true, currentCall: { channelId: roomId, channelName: roomId } });
          
          // Настраиваем обработчики LiveKit комнаты
          room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
            if (participant instanceof RemoteParticipant) {
              get().handleSubscribedTrack(track, publication, participant);
            }
          });
          
          room.on(RoomEvent.TrackUnsubscribed, (track, publication, participant) => {
            if (participant instanceof RemoteParticipant) {
              get().handleUnsubscribedTrack(track, publication, participant);
            }
          });
          
          // Создаем аудио поток
          await get().createAudioStream();
          
          // Отправляем начальное состояние
          livekitApi.sendMuteState(state.isMuted);
          livekitApi.sendAudioState(!state.isGlobalAudioMuted, state.isGlobalAudioMuted);
          
          audioNotificationManager.playUserJoinedSound().catch(console.warn);
        } catch (error) {
          console.error('Failed to join room:', error);
          set({ error: error.message });
        }
      },
      
      // Обработка нового трека
      handleNewTrack: async (producerData) => {
        const room = get().room;
        if (!room) return;
        
        // LiveKit автоматически подписывается на треки, обработка в handleSubscribedTrack
      },
      
      // Обработка подписанного трека
      handleSubscribedTrack: async (track, publication, participant) => {
        const userId = participant.identity;
        const isScreenShare = publication.source === Track.Source.ScreenShare;
        const isCamera = publication.source === Track.Source.Camera;
        
        if (track.kind === 'audio' && !isScreenShare) {
          // Обработка аудио трека
          await get().setupAudioTrack(track, userId);
        } else if (track.kind === 'video') {
          if (isScreenShare) {
            // Демонстрация экрана
            const screenStream = new MediaStream([track.mediaStreamTrack]);
            set((state) => {
              const newRemoteScreenShares = new Map(state.remoteScreenShares);
              newRemoteScreenShares.set(publication.trackSid, {
                stream: screenStream,
                producerId: publication.trackSid,
                userId: userId,
                userName: participant.name || 'Unknown',
                socketId: userId
              });
              return { remoteScreenShares: newRemoteScreenShares };
            });
          } else if (isCamera) {
            // Вебкамера
            const videoStream = new MediaStream([track.mediaStreamTrack]);
            set((state) => ({
              participants: state.participants.map(p => 
                p.userId === userId 
                  ? { ...p, isVideoEnabled: true, videoStream: videoStream }
                  : p
              )
            }));
          }
        }
      },
      
      // Обработка отписанного трека
      handleUnsubscribedTrack: (track, publication, participant) => {
        const userId = participant.identity;
        
        if (publication.source === Track.Source.ScreenShare) {
          const newRemoteScreenShares = new Map(get().remoteScreenShares);
          newRemoteScreenShares.delete(publication.trackSid);
          set({ remoteScreenShares: newRemoteScreenShares });
        } else if (publication.source === Track.Source.Camera) {
          set((state) => ({
            participants: state.participants.map(p => 
              p.userId === userId 
                ? { ...p, isVideoEnabled: false, videoStream: null }
                : p
            )
          }));
        }
      },
      
      // Настройка аудио трека
      setupAudioTrack: async (track, userId) => {
        // Инициализируем AudioContext
        let audioContext = get().audioContext;
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
        audioElement.srcObject = new MediaStream([track.mediaStreamTrack]);
        audioElement.autoplay = true;
        audioElement.playsInline = true;
        audioElement.controls = false;
        audioElement.style.display = 'none';
        document.body.appendChild(audioElement);
        
        // Создаем Web Audio API chain
        const source = audioContext.createMediaStreamSource(new MediaStream([track.mediaStreamTrack]));
        const gainNode = audioContext.createGain();
        
        const initialVolume = get().userVolumes.get(userId) || 100;
        const isMuted = get().userMutedStates.get(userId) || false;
        const audioVolume = get().isGlobalAudioMuted ? 0 : (isMuted ? 0 : (initialVolume / 100.0));
        audioElement.volume = audioVolume;
        
        // Voice detection через AudioWorklet
        try {
          if (!get().voiceWorkletLoaded) {
            await audioContext.audioWorklet.addModule('/voice-detector.worklet.js');
            set({ voiceWorkletLoaded: true });
          }
          
          const voiceDetectorNode = new AudioWorkletNode(audioContext, 'voice-detector', {
            numberOfInputs: 1,
            numberOfOutputs: 1,
            channelCount: 1
          });
          
          source.connect(voiceDetectorNode);
          voiceDetectorNode.connect(gainNode);
          
          voiceDetectorNode.port.onmessage = (event) => {
            const { speaking } = event.data;
            const currentState = get();
            const wasSpeaking = currentState.speakingUsers.has(userId);
            
            if (speaking !== wasSpeaking) {
              set((state) => {
                const newSpeakingUsers = new Set(state.speakingUsers);
                if (speaking) {
                  newSpeakingUsers.add(userId);
                } else {
                  newSpeakingUsers.delete(userId);
                }
                return { speakingUsers: newSpeakingUsers };
              });
            }
          };
          
          set((state) => {
            const newGainNodes = new Map(state.gainNodes);
            const newAudioElements = new Map(state.audioElements);
            const newVoiceDetectorNodes = new Map(state.voiceDetectorNodes || new Map());
            const newVoiceDetectorSources = new Map(state.voiceDetectorSources || new Map());
            
            newGainNodes.set(userId, gainNode);
            newAudioElements.set(userId, audioElement);
            newVoiceDetectorNodes.set(userId, voiceDetectorNode);
            newVoiceDetectorSources.set(userId, source);
            
            const newUserVolumes = new Map(state.userVolumes);
            if (!newUserVolumes.has(userId)) {
              newUserVolumes.set(userId, 100);
            }
            
            return {
              gainNodes: newGainNodes,
              audioElements: newAudioElements,
              voiceDetectorNodes: newVoiceDetectorNodes,
              voiceDetectorSources: newVoiceDetectorSources,
              userVolumes: newUserVolumes
            };
          });
        } catch (error) {
          console.error(`Failed to setup voice detection for ${userId}:`, error);
          source.connect(gainNode);
          
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
        }
        
        try {
          await audioElement.play();
          set({ audioBlocked: false });
        } catch (error) {
          console.log('Auto-play blocked:', error);
          set({ audioBlocked: true });
        }
      },
      
      // Создание аудио потока
      createAudioStream: async () => {
        try {
          const state = get();
          const room = state.room;
          if (!room) return;
          
          // Останавливаем старый поток
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
              channelCount: 1
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
          
          const processedStream = noiseSuppressionManager.getProcessedStream();
          const audioTrack = processedStream.getAudioTracks()[0];
          
          if (!audioTrack) {
            throw new Error('No audio track in processed stream');
          }
          
          // Применяем шумоподавление если включено
          if (state.isNoiseSuppressed) {
            await noiseSuppressionManager.enable(state.noiseSuppressionMode);
          }
          
          // Публикуем трек в LiveKit
          await room.localParticipant.publishTrack(audioTrack, {
            source: Track.Source.Microphone,
            name: `${state.currentUserName}'s microphone`
          });
          
          // Устанавливаем состояние микрофона
          audioTrack.enabled = !state.isMuted;
          
          console.log('Audio stream created with LiveKit');
        } catch (error) {
          console.error('Failed to create audio stream:', error);
          set({ error: error.message });
        }
      },
      
      // Переключение микрофона
      toggleMute: () => {
        const state = get();
        const newMutedState = !state.isMuted;
        
        localStorage.setItem('micMuted', JSON.stringify(newMutedState));
        
        if (state.room && state.room.localParticipant) {
          const audioTrack = state.room.localParticipant.audioTrackPublications.values().next().value;
          if (audioTrack && audioTrack.track) {
            audioTrack.track.setEnabled(!newMutedState);
          }
        }
        
        livekitApi.sendMuteState(newMutedState);
        set({ isMuted: newMutedState });
        
        if (newMutedState) {
          audioNotificationManager.playMicMutedSound().catch(console.warn);
        } else {
          audioNotificationManager.playMicUnmutedSound().catch(console.warn);
        }
      },
      
      // Переключение мута для отдельного пользователя
      toggleUserMute: (userId) => {
        if (userId.startsWith('screen-share-audio-')) {
          console.log('Cannot mute screen share audio:', userId);
          return;
        }
        
        const state = get();
        const audioElement = state.audioElements.get(userId);
        if (!audioElement) return;

        const isCurrentlyMuted = state.userMutedStates.get(userId) || false;
        const newIsMuted = !isCurrentlyMuted;

        if (newIsMuted) {
          const currentVolume = state.userVolumes.get(userId) || 100;
          set((state) => {
            const newPreviousVolumes = new Map(state.previousVolumes);
            newPreviousVolumes.set(userId, currentVolume);
            return { previousVolumes: newPreviousVolumes };
          });
          audioElement.volume = 0;
        } else {
          const currentVolume = state.userVolumes.get(userId) || 100;
          const audioVolume = state.isGlobalAudioMuted ? 0 : (currentVolume / 100.0);
          audioElement.volume = audioVolume;
        }

        set((state) => {
          const newUserMutedStates = new Map(state.userMutedStates);
          newUserMutedStates.set(userId, newIsMuted);
          return { userMutedStates: newUserMutedStates };
        });
      },
      
      // Изменение громкости отдельного пользователя
      changeUserVolume: (userId, newVolume) => {
        if (userId.startsWith('screen-share-audio-')) {
          console.log('Cannot change volume for screen share audio:', userId);
          return;
        }
        
        const state = get();
        const audioElement = state.audioElements.get(userId);
        if (!audioElement) return;

        const audioVolume = state.isGlobalAudioMuted ? 0 : (newVolume / 100.0);
        audioElement.volume = audioVolume;

        set((state) => {
          const newUserVolumes = new Map(state.userVolumes);
          newUserVolumes.set(userId, newVolume);
          return { userVolumes: newUserVolumes };
        });

        // Если размутиваем через слайдер, обновляем состояние мута
        if (newVolume > 0 && state.userMutedStates.get(userId)) {
          set((state) => {
            const newUserMutedStates = new Map(state.userMutedStates);
            newUserMutedStates.set(userId, false);
            return { userMutedStates: newUserMutedStates };
          });
        } else if (newVolume === 0 && !state.userMutedStates.get(userId)) {
          set((state) => {
            const newUserMutedStates = new Map(state.userMutedStates);
            newUserMutedStates.set(userId, true);
            return { userMutedStates: newUserMutedStates };
          });
        }
      },
      
      // Переключение отображения слайдера громкости
      toggleVolumeSlider: (userId) => {
        set((state) => {
          const newShowVolumeSliders = new Map(state.showVolumeSliders);
          const currentState = newShowVolumeSliders.get(userId) || false;
          newShowVolumeSliders.set(userId, !currentState);
          return { showVolumeSliders: newShowVolumeSliders };
        });
      },
      
      // Глобальное отключение/включение звука всех участников
      toggleGlobalAudio: () => {
        const state = get();
        const newMutedState = !state.isGlobalAudioMuted;
        
        localStorage.setItem('audioMuted', JSON.stringify(newMutedState));
        
        livekitApi.sendAudioState(!newMutedState, newMutedState);
        
        set({ isGlobalAudioMuted: newMutedState, isAudioEnabled: !newMutedState });
        
        set((state) => {
          const newGlobalAudioStates = new Map(state.participantGlobalAudioStates);
          newGlobalAudioStates.set(state.currentUserId, newMutedState);
          return { participantGlobalAudioStates: newGlobalAudioStates };
        });
        
        // Управляем HTML Audio элементами
        state.audioElements.forEach((audioElement, userId) => {
          if (userId.startsWith('screen-share-audio-')) return;
          
          if (audioElement) {
            if (newMutedState) {
              audioElement.volume = 0;
            } else {
              const volume = state.userVolumes.get(userId) || 100;
              const isIndividuallyMuted = state.userMutedStates.get(userId) || false;
              const audioVolume = isIndividuallyMuted ? 0 : (volume / 100.0);
              audioElement.volume = audioVolume;
            }
          }
        });
        
        if (newMutedState) {
          audioNotificationManager.playGlobalMutedSound().catch(console.warn);
        } else {
          audioNotificationManager.playGlobalUnmutedSound().catch(console.warn);
        }
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
            return true;
          }

          if (success) {
            set({ noiseSuppressionMode: mode, isNoiseSuppressed: true });
            localStorage.setItem('noiseSuppression', JSON.stringify(true));
            return true;
          }
          
          return false;
        } catch (error) {
          console.error('Error changing noise suppression mode:', error);
          return false;
        }
      },
      
      // Обработка удаленного трека
      handleTrackRemoved: (data) => {
        const userId = data.producerSocketId || data.userId;
        const isScreenShare = data.mediaType === 'screen';
        
        if (isScreenShare) {
          const newRemoteScreenShares = new Map(get().remoteScreenShares);
          newRemoteScreenShares.delete(data.producerId);
          set({ remoteScreenShares: newRemoteScreenShares });
        }
      },
      
      // Завершение звонка
      endCall: async () => {
        try {
          const state = get();
          
          livekitApi.off('peerJoined');
          livekitApi.off('peerLeft');
          livekitApi.off('peerMuteStateChanged');
          livekitApi.off('peerAudioStateChanged');
          livekitApi.off('newProducer');
          livekitApi.off('producerClosed');
          
          if (state.localStream) {
            state.localStream.getTracks().forEach(track => track.stop());
          }
          
          if (state.noiseSuppressionManager) {
            state.noiseSuppressionManager.cleanup();
          }
          
          if (state.audioContext && state.audioContext.state !== 'closed') {
            await state.audioContext.close();
          }
          
          // Очищаем VoiceDetector worklet nodes
          state.voiceDetectorNodes.forEach((node, userId) => {
            try {
              node.port.close();
              node.disconnect();
            } catch (e) {
              console.warn(`Error disconnecting voice detector for ${userId}:`, e);
            }
          });
          
          // Очищаем source nodes
          state.voiceDetectorSources.forEach((source, userId) => {
            try {
              source.disconnect();
            } catch (e) {
              console.warn(`Error disconnecting source for ${userId}:`, e);
            }
          });
          
          // Очищаем все ресурсы
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
          
          await livekitApi.disconnect();
          
          set({
            isConnected: false,
            isInCall: false,
            currentRoomId: null,
            currentCall: null,
            room: null,
            participants: [],
            participantMuteStates: new Map(),
            participantAudioStates: new Map(),
            participantGlobalAudioStates: new Map(),
            participantVideoStates: new Map(),
            userVolumes: new Map(),
            userMutedStates: new Map(),
            showVolumeSliders: new Map(),
            gainNodes: new Map(),
            audioElements: new Map(),
            previousVolumes: new Map(),
            voiceDetectorNodes: new Map(),
            voiceDetectorSources: new Map(),
            voiceWorkletLoaded: false,
            speakingUsers: new Set(),
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
          const room = state.room;
          if (!room) {
            throw new Error('Room not ready');
          }

          if (state.isScreenSharing) {
            await get().stopScreenShare();
          }

          console.log('🖥️ Requesting screen sharing access...');
          
          const stream = await navigator.mediaDevices.getDisplayMedia({
            video: {
              cursor: 'always',
              frameRate: { ideal: 60, max: 60 },
              width: { ideal: 1920, max: 1920 },
              height: { ideal: 1080, max: 1080 }
            },
            audio: {
              suppressLocalAudioPlayback: true,
              echoCancellation: false,
              noiseSuppression: false,
              autoGainControl: false,
              sampleRate: 48000,
              channelCount: 2
            }
          });

          const videoTrack = stream.getVideoTracks()[0];
          if (!videoTrack) {
            throw new Error('No video track available');
          }

          set({ screenShareStream: stream });

          // Публикуем video трек
          await room.localParticipant.publishTrack(videoTrack, {
            source: Track.Source.ScreenShare,
            name: `${state.currentUserName}'s screen`
          });

          // Публикуем audio трек если есть
          const audioTrack = stream.getAudioTracks()[0];
          if (audioTrack) {
            await room.localParticipant.publishTrack(audioTrack, {
              source: Track.Source.ScreenShareAudio,
              name: `${state.currentUserName}'s screen audio`
            });
          }

          videoTrack.onended = () => {
            get().stopScreenShare();
          };

          set({ isScreenSharing: true });
          console.log('🎉 Screen sharing started successfully!');
        } catch (error) {
          console.error('Error starting screen share:', error);
          set({ error: 'Failed to start screen sharing: ' + error.message });
        }
      },

      stopScreenShare: async () => {
        try {
          const state = get();
          const room = state.room;
          
          if (room && room.localParticipant) {
            // Останавливаем все screen share треки
            const screenShareTracks = Array.from(room.localParticipant.videoTrackPublications.values())
              .filter(pub => pub.source === Track.Source.ScreenShare);
            
            for (const publication of screenShareTracks) {
              if (publication.track) {
                publication.track.stop();
                await room.localParticipant.unpublishTrack(publication.track);
              }
            }
          }

          if (state.screenShareStream) {
            state.screenShareStream.getTracks().forEach(track => track.stop());
          }

          set({ screenShareStream: null, isScreenSharing: false });
          console.log('Screen sharing stopped successfully');
        } catch (error) {
          console.error('Error stopping screen share:', error);
          set({ error: 'Failed to stop screen sharing: ' + error.message });
        }
      },

      toggleScreenShare: async () => {
        const state = get();
        if (state.isScreenSharing) {
          await get().stopScreenShare();
        } else {
          await get().startScreenShare();
        }
      },

      // Включение вебкамеры
      startVideo: async () => {
        try {
          const state = get();
          const room = state.room;
          if (!room) {
            throw new Error('Room not ready');
          }

          console.log('Requesting camera access...');
          const cameraStream = await navigator.mediaDevices.getUserMedia({
            video: {
              width: { ideal: 1280, max: 1920 },
              height: { ideal: 720, max: 1080 },
              frameRate: { ideal: 30, max: 60 },
              facingMode: 'user'
            },
            audio: false
          });

          const videoTrack = cameraStream.getVideoTracks()[0];
          if (!videoTrack) {
            throw new Error('No video track available');
          }

          set({ cameraStream: cameraStream, isVideoEnabled: true });

          // Публикуем video трек
          await room.localParticipant.publishTrack(videoTrack, {
            source: Track.Source.Camera,
            name: `${state.currentUserName}'s camera`
          });

          videoTrack.onended = () => {
            get().stopVideo();
          };

          console.log('Video started successfully');
        } catch (error) {
          console.error('Error starting video:', error);
          set({ error: 'Failed to start video: ' + error.message });
        }
      },

      // Выключение вебкамеры
      stopVideo: async () => {
        try {
          const state = get();
          const room = state.room;
          
          if (room && room.localParticipant) {
            const cameraTracks = Array.from(room.localParticipant.videoTrackPublications.values())
              .filter(pub => pub.source === Track.Source.Camera);
            
            for (const publication of cameraTracks) {
              if (publication.track) {
                publication.track.stop();
                await room.localParticipant.unpublishTrack(publication.track);
              }
            }
          }

          if (state.cameraStream) {
            state.cameraStream.getTracks().forEach(track => track.stop());
          }

          set({ isVideoEnabled: false, cameraStream: null });
          console.log('Video stopped successfully');
        } catch (error) {
          console.error('Error stopping video:', error);
          set({ error: 'Failed to stop video: ' + error.message });
        }
      },

      toggleVideo: async () => {
        const state = get();
        if (state.isVideoEnabled) {
          await get().stopVideo();
        } else {
          await get().startVideo();
        }
      },

      // ========== Audio Device Management ==========
      
      getAudioOutputDevices: async () => {
        const audioDeviceManager = getAudioDeviceManager();
        return await audioDeviceManager.getAudioOutputDevices();
      },

      setParticipantsAudioDevice: async (deviceId) => {
        const audioDeviceManager = getAudioDeviceManager();
        audioDeviceManager.setParticipantsOutputDevice(deviceId);
        
        const state = get();
        const updatePromises = [];
        
        state.audioElements.forEach((audioElement, userId) => {
          if (!userId.startsWith('screen-share-audio-')) {
            updatePromises.push(audioDeviceManager.applyAudioOutput(audioElement, deviceId));
          }
        });
        
        await Promise.all(updatePromises);
        console.log('✅ Audio output device updated for all participants');
      },

      autoSelectHeadphones: async () => {
        const audioDeviceManager = getAudioDeviceManager();
        const headphones = await audioDeviceManager.autoSelectHeadphones();
        
        if (headphones) {
          await get().setParticipantsAudioDevice(headphones.deviceId);
          console.log('🎧 Headphones selected:', headphones.label);
          return headphones;
        }
        
        return null;
      },

      getCurrentAudioDevice: async () => {
        const audioDeviceManager = getAudioDeviceManager();
        return await audioDeviceManager.getCurrentDeviceInfo();
      },

      isAudioDeviceSelectionSupported: () => {
        const audioDeviceManager = getAudioDeviceManager();
        return audioDeviceManager.isSinkIdSupported();
      }
    }),
    {
      name: 'livekit-call-store',
    }
  )
);

