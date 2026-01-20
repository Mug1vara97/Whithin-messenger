import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { voiceCallApi } from '../../../entities/voice-call/api/voiceCallApi';
import { NoiseSuppressionManager } from '../utils/noiseSuppression';
import { audioNotificationManager } from '../utils/audioNotifications';
import { VoiceActivityDetector } from '../utils/voiceActivityDetector';
import { RoomEvent, Track } from 'livekit-client';
import { userApi } from '../../../entities/user/api/userApi';
import { MEDIA_BASE_URL } from '../constants/apiEndpoints';

// Определяет, является ли banner путём к изображению или цветом
const isBannerImage = (banner) => {
  if (!banner) return false;
  
  // Если начинается с #, это цвет
  if (banner.startsWith('#')) return false;
  
  // Если содержит расширения изображений, это путь к файлу
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp'];
  const lowerBanner = banner.toLowerCase();
  if (imageExtensions.some(ext => lowerBanner.includes(ext))) return true;
  
  // Если начинается с http://, https://, /uploads/, /api/, это путь
  if (banner.startsWith('http://') || 
      banner.startsWith('https://') || 
      banner.startsWith('/uploads/') || 
      banner.startsWith('/api/') ||
      banner.startsWith('uploads/')) {
    return true;
  }
  
  // Если это валидный hex-цвет (например, #5865f2), это цвет
  const hexColorPattern = /^#[0-9A-Fa-f]{6}$/;
  if (hexColorPattern.test(banner)) return false;
  
  // По умолчанию считаем цветом, если не похоже на путь
  return false;
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
      
      // Отдельные состояния для оптимизации (избегаем перерендера демонстрации экрана)
      participantMuteStates: new Map(), // userId -> isMuted
      participantAudioStates: new Map(), // userId -> isAudioEnabled
      participantGlobalAudioStates: new Map(), // userId -> isGlobalAudioMuted
      participantVideoStates: new Map(), // userId -> isVideoEnabled
      participantSpeakingStates: new Map(), // userId -> isSpeaking (Voice Activity Detection)
      
      // Состояние аудио (загружаем из localStorage)
      isMuted: (() => {
        try {
          const saved = localStorage.getItem('micMuted');
          const value = saved ? JSON.parse(saved) : false;
          console.log('🎤 Loaded mic state from localStorage:', value);
          return value;
        } catch {
          return false;
        }
      })(),
      isAudioEnabled: (() => {
        try {
          const saved = localStorage.getItem('audioMuted');
          const value = saved ? !JSON.parse(saved) : true; // инверсия: audioMuted=true значит isAudioEnabled=false
          console.log('🔊 Loaded audio state from localStorage:', value);
          return value;
        } catch {
          return true;
        }
      })(),
      isGlobalAudioMuted: (() => {
        try {
          const saved = localStorage.getItem('audioMuted');
          const value = saved ? JSON.parse(saved) : false;
          console.log('🎧 Loaded global audio muted state from localStorage:', value);
          return value;
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
      voiceActivityDetectors: new Map(), // userId -> VoiceActivityDetector
      localVoiceActivityDetector: null, // VAD для локального пользователя
      
      // Флаги состояния
      connecting: false,
      
      // Actions
      setError: (error) => set({ error }),
      clearError: () => set({ error: null }),
      
      setAudioBlocked: (blocked) => set({ audioBlocked: blocked }),
      
      // Voice Activity Detection (VAD) функции
      updateSpeakingState: (userId, isSpeaking) => {
        const state = get();
        // Не обновляем состояние говорения если микрофон замьючен (для локального пользователя)
        if (userId === state.currentUserId && state.isMuted && isSpeaking) {
          return; // Игнорируем speaking=true когда мьют включен
        }
        
        set((prevState) => {
          const newSpeakingStates = new Map(prevState.participantSpeakingStates);
          newSpeakingStates.set(userId, isSpeaking);
          return { participantSpeakingStates: newSpeakingStates };
        });
      },
      
      // Сброс состояния говорения для пользователя
      resetSpeakingState: (userId) => {
        set((state) => {
          const newSpeakingStates = new Map(state.participantSpeakingStates);
          newSpeakingStates.set(userId, false);
          return { participantSpeakingStates: newSpeakingStates };
        });
      },
      
      // Инициализация VAD для локального пользователя
      initializeLocalVAD: async (stream, audioContext) => {
        const state = get();
        const userId = state.currentUserId;
        
        if (!userId || !stream) return;
        
        // Очищаем старый детектор
        if (state.localVoiceActivityDetector) {
          state.localVoiceActivityDetector.cleanup();
        }
        
        const detector = new VoiceActivityDetector({
          audioContext,
          threshold: 30, // Увеличен порог для меньшей чувствительности
          holdTime: 350,
          onSpeakingChange: (isSpeaking) => {
            // Проверяем состояние мьюта перед обновлением
            const currentState = get();
            if (currentState.isMuted) {
              // Если замьючен, всегда устанавливаем speaking = false
              if (currentState.participantSpeakingStates.get(userId)) {
                get().resetSpeakingState(userId);
              }
              // Отправляем speaking: false на сервер
              if (voiceCallApi.socket) {
                voiceCallApi.socket.emit('speaking', { speaking: false });
              }
              return;
            }
            
            // Обновляем локальное состояние
            get().updateSpeakingState(userId, isSpeaking);
            
            // Отправляем состояние на сервер для рассылки всем участникам
            if (voiceCallApi.socket) {
              voiceCallApi.socket.emit('speaking', { speaking: isSpeaking });
              console.log('[VAD] Sent speaking state to server:', isSpeaking);
            }
          }
        });
        
        await detector.start(stream, audioContext);
        set({ localVoiceActivityDetector: detector });
        console.log('[VAD] Initialized local voice activity detector for user:', userId);
      },
      
      // Слушать состояние говорения от сервера для удалённых участников
      initializeSpeakingStateListener: () => {
        if (!voiceCallApi.socket) {
          console.warn('[VAD] Socket not available for speaking state listener');
          return;
        }
        
        // Удаляем предыдущий обработчик если есть
        voiceCallApi.socket.off('speakingStateChanged');
        
        // Слушаем состояния говорения от сервера
        voiceCallApi.socket.on('speakingStateChanged', ({ peerId, userId: eventUserId, speaking }) => {
          console.log('[VAD] Received speaking state from server:', { peerId, userId: eventUserId, speaking });
          
          // Не обновляем состояние для локального пользователя (он обновляется через локальный VAD)
          const currentState = get();
          if (peerId === voiceCallApi.socket?.id) {
            return;
          }
          
          // Определяем userId
          // 1. Используем userId из события если он есть
          let userId = eventUserId;
          
          // 2. Если нет, ищем в peerIdToUserIdMap
          if (!userId) {
            userId = currentState.peerIdToUserIdMap?.get(peerId);
          }
          
          // 3. Если не нашли, ищем среди участников по peerId
          if (!userId) {
            const participant = currentState.participants.find(p => 
              p.peerId === peerId || p.socketId === peerId
            );
            if (participant) {
              userId = participant.userId || participant.id;
            }
          }
          
          // 4. Если всё ещё не нашли userId, используем peerId
          if (!userId) {
            console.warn('[VAD] Could not find userId for peerId, participants:', 
              currentState.participants.map(p => ({ peerId: p.peerId, userId: p.userId }))
            );
            userId = peerId;
          }
          
          // Сохраняем маппинг для будущих запросов
          if (userId && userId !== peerId && !currentState.peerIdToUserIdMap?.has(peerId)) {
            const newMap = new Map(currentState.peerIdToUserIdMap);
            newMap.set(peerId, userId);
            set({ peerIdToUserIdMap: newMap });
            console.log('[VAD] Added mapping peerId -> userId:', { peerId, userId });
          }
          
          console.log('[VAD] Using userId:', { peerId, userId, speaking });
          
          // Проверяем состояние мьюта удалённого участника
          const participantIsMuted = currentState.participantMuteStates?.get(userId);
          if (participantIsMuted && speaking) {
            console.log('[VAD] Skipping speaking state for muted participant:', userId);
            return; // Не показываем индикацию если участник замьючен
          }
          
          get().updateSpeakingState(userId, speaking);
        });
        
        console.log('[VAD] Speaking state listener initialized');
      },
      
      // Инициализация VAD для удалённого участника (устарело - теперь состояние приходит от сервера)
      initializeRemoteVAD: async (userId, stream, audioContext) => {
        // Больше не используем локальный VAD для удалённых участников
        // Состояние говорения приходит от сервера через speakingStateChanged событие
        console.log('[VAD] Remote VAD skipped for user (using server state):', userId);
      },
      
      // Очистка VAD для участника
      cleanupVAD: (userId) => {
        const state = get();
        
        const detector = state.voiceActivityDetectors.get(userId);
        if (detector) {
          detector.cleanup();
          const newDetectors = new Map(state.voiceActivityDetectors);
          newDetectors.delete(userId);
          
          const newSpeakingStates = new Map(state.participantSpeakingStates);
          newSpeakingStates.delete(userId);
          
          set({ 
            voiceActivityDetectors: newDetectors,
            participantSpeakingStates: newSpeakingStates
          });
          console.log('[VAD] Cleaned up voice activity detector for user:', userId);
        }
      },
      
      // Очистка всех VAD
      cleanupAllVAD: () => {
        const state = get();
        
        if (state.localVoiceActivityDetector) {
          state.localVoiceActivityDetector.cleanup();
        }
        
        for (const detector of state.voiceActivityDetectors.values()) {
          detector.cleanup();
        }
        
        set({
          localVoiceActivityDetector: null,
          voiceActivityDetectors: new Map(),
          participantSpeakingStates: new Map()
        });
        console.log('[VAD] Cleaned up all voice activity detectors');
      },
      
      // Инициализация звонка
      initializeCall: async (userId, userName) => {
        const state = get();
        if (state.connecting) {
          console.log('Connection already in progress, skipping');
          return;
        }
        
        set({ connecting: true, currentUserId: userId, currentUserName: userName });
        
        try {
          // Инициализируем звуковой менеджер
          await audioNotificationManager.initialize();
          
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
          voiceCallApi.on('peerJoined', async (peerData) => {
            console.log('Peer joined:', peerData);
            const socketId = peerData.peerId || peerData.id;
            const peerUserId = peerData.userId;
            
            // Обновляем маппинг peerId -> userId
            if (socketId && peerUserId) {
              const newMap = new Map(get().peerIdToUserIdMap);
              newMap.set(socketId, peerUserId);
              set({ peerIdToUserIdMap: newMap });
              console.log('[VAD] peerJoined: Added mapping', { socketId, userId: peerUserId });
            } else {
              console.warn('[VAD] peerJoined: Missing socketId or userId', { socketId, userId: peerUserId, peerData });
            }
            
            // Обновляем participantGlobalAudioStates для реактивности UI
            set((state) => {
              const newGlobalAudioStates = new Map(state.participantGlobalAudioStates);
              if (peerData.isGlobalAudioMuted !== undefined) {
                newGlobalAudioStates.set(peerData.userId, peerData.isGlobalAudioMuted);
                console.log('Updated participantGlobalAudioStates for user:', peerData.userId, 'isGlobalAudioMuted:', peerData.isGlobalAudioMuted);
              }
              return { participantGlobalAudioStates: newGlobalAudioStates };
            });
            
            // Загружаем профиль участника
            let profileData = null;
            try {
              const profile = await userApi.getProfile(peerData.userId);
              if (profile) {
                // Определяем, является ли banner изображением или цветом
                const bannerIsImage = isBannerImage(profile.banner);
                const bannerValue = profile.banner 
                  ? (bannerIsImage ? `${MEDIA_BASE_URL}${profile.banner}` : profile.banner)
                  : null;
                
                profileData = {
                  avatar: profile.avatar ? `${MEDIA_BASE_URL}${profile.avatar}` : null,
                  avatarColor: profile.avatarColor || '#5865f2',
                  banner: bannerValue
                };
                console.log('📸 Loaded profile for participant:', peerData.userId, profileData);
              }
            } catch (error) {
              console.warn('Failed to load profile for participant:', peerData.userId, error);
            }
            
            set((state) => ({
              participants: [...state.participants.filter(p => p.userId !== peerData.userId), {
                userId: peerData.userId,
                peerId: socketId,
                name: peerData.name,
                isMuted: peerData.isMuted || false,
                isAudioEnabled: peerData.isAudioEnabled !== undefined ? peerData.isAudioEnabled : true,
                isGlobalAudioMuted: peerData.isGlobalAudioMuted || false, // Добавляем статус глобального звука
                isSpeaking: false,
                avatar: profileData?.avatar || null,
                avatarColor: profileData?.avatarColor || '#5865f2',
                banner: profileData?.banner || null
              }]
            }));

            // Воспроизводим звук подключения пользователя
            audioNotificationManager.playUserJoinedSound().catch(error => {
              console.warn('Failed to play user joined sound:', error);
            });
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
              
              // Очищаем Voice Activity Detector для этого пользователя
              get().cleanupVAD(userId);
              
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

            // Воспроизводим звук отключения пользователя
            audioNotificationManager.playUserLeftSound().catch(error => {
              console.warn('Failed to play user left sound:', error);
            });
          });

          voiceCallApi.on('peerMuteStateChanged', ({ peerId, isMuted }) => {
            const userId = get().peerIdToUserIdMap.get(peerId) || peerId;
            const mutedState = Boolean(isMuted);
            
            // Обновляем только отдельное состояние мьюта, не весь массив участников
            set((state) => {
              const newMuteStates = new Map(state.participantMuteStates);
              newMuteStates.set(userId, mutedState);
              return { participantMuteStates: newMuteStates };
            });
            
            // Обновляем участников только если нужно (для совместимости)
            set((state) => ({
              participants: state.participants.map(p => 
                p.userId === userId ? { ...p, isMuted: mutedState, isSpeaking: mutedState ? false : p.isSpeaking } : p
              )
            }));
          });

          voiceCallApi.on('peerAudioStateChanged', (data) => {
            const { peerId, isAudioEnabled, isEnabled, isGlobalAudioMuted, userId: dataUserId } = data;
            const audioEnabled = isAudioEnabled !== undefined ? isAudioEnabled : isEnabled;
            const userId = dataUserId || get().peerIdToUserIdMap.get(peerId) || peerId;
            
            console.log('peerAudioStateChanged received:', { peerId, userId, isAudioEnabled: audioEnabled, isGlobalAudioMuted });
            console.log('Full data received:', data);
            
            // Обновляем отдельные состояния для оптимизации
            set((state) => {
              const newAudioStates = new Map(state.participantAudioStates);
              newAudioStates.set(userId, Boolean(audioEnabled));
              
              const newGlobalAudioStates = new Map(state.participantGlobalAudioStates);
              if (isGlobalAudioMuted !== undefined) {
                newGlobalAudioStates.set(userId, isGlobalAudioMuted);
              }
              
              return {
                participantAudioStates: newAudioStates,
                participantGlobalAudioStates: newGlobalAudioStates
              };
            });
            
            // Обновляем участников только если нужно (для совместимости)
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

          // Handle TrackSubscribed events from LiveKit (for callStore)
          voiceCallApi.on('trackSubscribed', async ({ track, publication, participant, userId, mediaType }) => {
            console.log('🔊 callStore: Track subscribed event received:', { 
              trackSid: track?.sid, 
              kind: track?.kind, 
              userId, 
              mediaType,
              hasMediaStreamTrack: !!track?.mediaStreamTrack
            });
            
            // Check if track has mediaStreamTrack
            if (!track.mediaStreamTrack) {
              console.error('callStore: Track has no mediaStreamTrack!', track);
              return;
            }
            
            const state = get();
            const targetUserId = userId || participant.identity;
            
            // Handle VIDEO tracks (screen share and camera)
            if (track.kind === 'video') {
              console.log('🎥 callStore: Video track subscribed:', { mediaType, targetUserId });
              
              // Skip own video tracks
              if (targetUserId === state.currentUserId) {
                console.log('🎥 callStore: Skipping own video track');
                return;
              }
              
              const videoStream = new MediaStream([track.mediaStreamTrack]);
              
              if (mediaType === 'screen') {
                // Screen share video
                console.log('🖥️ callStore: Remote screen share detected for user:', targetUserId);
                
                const newRemoteScreenShares = new Map(state.remoteScreenShares);
                newRemoteScreenShares.set(track.sid, {
                  stream: videoStream,
                  producerId: track.sid,
                  userId: targetUserId,
                  userName: participant.name || targetUserId,
                  socketId: participant.identity
                });
                
                set({ remoteScreenShares: newRemoteScreenShares });
                console.log('🖥️ callStore: Remote screen share added, total:', newRemoteScreenShares.size);
              } else if (mediaType === 'camera') {
                // Camera video
                console.log('📹 callStore: Remote camera video detected for user:', targetUserId);
                
                // Update participant video states
                set((state) => {
                  const newVideoStates = new Map(state.participantVideoStates);
                  newVideoStates.set(targetUserId, true);
                  return { participantVideoStates: newVideoStates };
                });
                
                // Update participant with video stream
                set((state) => ({
                  participants: state.participants.map(p => 
                    p.userId === targetUserId 
                      ? { ...p, isVideoEnabled: true, videoStream: videoStream }
                      : p
                  )
                }));
                
                console.log('📹 callStore: Participant video updated for:', targetUserId);
              }
              
              return; // Exit after handling video
            }
            
            // Handle AUDIO tracks
            // Skip screen share audio (handled separately if needed)
            if (mediaType === 'screen') {
              console.log('🔊 callStore: Screen share audio track, creating audio element');
              // Create audio element for screen share audio
              const audioElement = document.createElement('audio');
              audioElement.srcObject = new MediaStream([track.mediaStreamTrack]);
              audioElement.autoplay = true;
              audioElement.volume = 1.0;
              audioElement.playsInline = true;
              audioElement.style.display = 'none';
              document.body.appendChild(audioElement);
              
              try {
                await audioElement.play();
                console.log('🔊 callStore: Screen share audio playback started');
              } catch (error) {
                console.warn('🔊 callStore: Screen share audio autoplay blocked:', error);
              }
              return;
            }
            
            // Check if we already have an audio element for this user
            if (state.audioElements.has(targetUserId)) {
              console.log('🔊 callStore: Audio element already exists for user:', targetUserId, 'updating...');
              const existingElement = state.audioElements.get(targetUserId);
              existingElement.srcObject = new MediaStream([track.mediaStreamTrack]);
              try {
                await existingElement.play();
                console.log('🔊 callStore: Updated audio element playback started');
              } catch (error) {
                console.warn('🔊 callStore: Failed to play updated audio element:', error);
              }
              return;
            }
            
            // Initialize AudioContext if needed
            let audioContext = state.audioContext;
            if (!audioContext || audioContext.state === 'closed') {
              audioContext = new (window.AudioContext || window.webkitAudioContext)({
                sampleRate: 48000,
                latencyHint: 'interactive'
              });
              set({ audioContext });
            }
            
            // Resume audio context if suspended
            if (audioContext.state === 'suspended') {
              await audioContext.resume();
            }
            
            // Create audio element
            const audioElement = document.createElement('audio');
            const mediaStream = new MediaStream([track.mediaStreamTrack]);
            audioElement.srcObject = mediaStream;
            audioElement.autoplay = true;
            audioElement.playsInline = true;
            audioElement.controls = false;
            audioElement.style.display = 'none';
            document.body.appendChild(audioElement);
            console.log('🔊 callStore: Created audio element for user:', targetUserId);
            
            // Create Web Audio API chain: source -> gain
            const source = audioContext.createMediaStreamSource(mediaStream);
            const gainNode = audioContext.createGain();
            
            // Set initial volume
            const initialVolume = state.userVolumes.get(targetUserId) || 100;
            const isMuted = state.userMutedStates.get(targetUserId) || false;
            const audioVolume = state.isGlobalAudioMuted ? 0 : (isMuted ? 0 : (initialVolume / 100.0));
            audioElement.volume = audioVolume;
            gainNode.gain.value = audioVolume;
            
            // Connect source -> gain (not to destination to avoid double playback)
            source.connect(gainNode);
            
            // Save references
            set((state) => {
              const newGainNodes = new Map(state.gainNodes);
              const newAudioElements = new Map(state.audioElements);
              const newUserVolumes = new Map(state.userVolumes);
              
              newGainNodes.set(targetUserId, gainNode);
              newAudioElements.set(targetUserId, audioElement);
              if (!newUserVolumes.has(targetUserId)) {
                newUserVolumes.set(targetUserId, 100);
              }
              
              return {
                gainNodes: newGainNodes,
                audioElements: newAudioElements,
                userVolumes: newUserVolumes
              };
            });
            
            // Try to play audio element
            try {
              await audioElement.play();
              console.log('🔊✅ callStore: Audio playback started for peer:', targetUserId);
              set({ audioBlocked: false });
            } catch (error) {
              console.warn('🔊⚠️ callStore: Auto-play blocked, user interaction required:', error);
              set({ audioBlocked: true });
              setTimeout(async () => {
                try {
                  await audioElement.play();
                  console.log('🔊✅ callStore: Audio playback started after delay');
                  set({ audioBlocked: false });
                } catch (err) {
                  console.error('🔊❌ callStore: Audio playback still blocked:', err);
                }
              }, 1000);
            }
          });

          // Handle video state changes (camera muted/unmuted)
          voiceCallApi.on('peerVideoStateChanged', ({ peerId, isVideoEnabled, userId, track, mediaType }) => {
            console.log('🎥 callStore: peerVideoStateChanged received:', { peerId, isVideoEnabled, userId, mediaType });
            
            const state = get();
            const targetUserId = userId || peerId;
            
            // Skip own video state changes
            if (targetUserId === state.currentUserId) {
              console.log('🎥 callStore: Skipping own video state change');
              return;
            }
            
            if (mediaType === 'camera') {
              // Update participant video states
              set((state) => {
                const newVideoStates = new Map(state.participantVideoStates);
                newVideoStates.set(targetUserId, isVideoEnabled);
                return { participantVideoStates: newVideoStates };
              });
              
              if (isVideoEnabled && track && track.mediaStreamTrack) {
                // Video enabled - update with new stream
                const videoStream = new MediaStream([track.mediaStreamTrack]);
                set((state) => ({
                  participants: state.participants.map(p => 
                    p.userId === targetUserId 
                      ? { ...p, isVideoEnabled: true, videoStream: videoStream }
                      : p
                  )
                }));
                console.log('📹 callStore: Participant video enabled for:', targetUserId);
              } else {
                // Video disabled - clear stream
                set((state) => ({
                  participants: state.participants.map(p => 
                    p.userId === targetUserId 
                      ? { ...p, isVideoEnabled: false, videoStream: null }
                      : p
                  )
                }));
                console.log('📹 callStore: Participant video disabled for:', targetUserId);
              }
            } else if (mediaType === 'screen') {
              // Handle screen share mute/unmute
              if (!isVideoEnabled) {
                // Screen share stopped - remove from remoteScreenShares
                console.log('🖥️ callStore: Screen share stopped for user:', targetUserId);
                set((state) => {
                  const newRemoteScreenShares = new Map(state.remoteScreenShares);
                  // Remove all screen shares from this user
                  for (const [key, value] of newRemoteScreenShares.entries()) {
                    if (value.userId === targetUserId) {
                      newRemoteScreenShares.delete(key);
                    }
                  }
                  return { remoteScreenShares: newRemoteScreenShares };
                });
              }
            }
          });

          voiceCallApi.on('newProducer', async (producerData) => {
            const state = get();
            // For LiveKit, newProducer is handled by trackSubscribed
            // Only use handleNewProducer for legacy mediasoup compatibility
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
            
            // Дополнительная диагностика для понимания типа producer
            console.log('🎥 Producer type analysis:', {
              isVideoProducer: producerKind === 'video' && mediaType === 'camera',
              isAudioProducer: producerKind === 'audio',
              isScreenShare: mediaType === 'screen',
              shouldCleanAudio: producerKind === 'audio' || mediaType === 'screen'
            });
            
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
              
              // Обновляем отдельное состояние веб-камеры
              set((state) => {
                const newVideoStates = new Map(state.participantVideoStates);
                newVideoStates.set(userId, false);
                return { participantVideoStates: newVideoStates };
              });
              
              // Обновляем участника - отключаем вебкамеру (для совместимости)
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
                console.log('🎥 Closing consumer for video producer:', producerId, 'kind:', consumer.kind);
                consumer.close();
                set((state) => {
                  const newConsumers = new Map(state.consumers);
                  newConsumers.delete(producerId);
                  return { consumers: newConsumers };
                });
              } else {
                console.log('🎥 No consumer found for video producer:', producerId);
              }
            } else {
              console.log('🎥 Preserving consumer for audio producer:', producerId);
              const consumer = get().consumers.get(producerId);
              if (consumer) {
                console.log('🎥 Audio consumer preserved:', producerId, 'kind:', consumer.kind, 'paused:', consumer.paused);
              } else {
                console.log('🎥 No audio consumer found for producer:', producerId);
              }
            }
            
            // ВАЖНО: НЕ очищаем audio elements и gain nodes для video producer!
            // Audio elements должны оставаться активными для аудио потока
            // Очищаем их только если это действительно audio producer (НЕ screen share!)
            if (producerSocketId && producerKind === 'audio' && mediaType !== 'screen') {
              const userId = get().peerIdToUserIdMap.get(producerSocketId);
              if (userId) {
                console.log('🎥 Cleaning up audio elements for audio producer:', producerId);
                // Очищаем audio element и gain node только для audio producer
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
            } else if (producerSocketId && (isVideoProducer || mediaType === 'screen')) {
              console.log('🎥 Video/Screen producer closed - preserving audio elements for user:', get().peerIdToUserIdMap.get(producerSocketId));
            }
          });

          // Обработчик для синхронизации статуса глобального звука
          voiceCallApi.on('globalAudioStateChanged', (data) => {
            const { userId, isGlobalAudioMuted } = data;
            console.log('Global audio state changed for user:', userId, 'muted:', isGlobalAudioMuted);
            
            // Обновляем только отдельное состояние глобального звука
            set((state) => {
              const newGlobalAudioStates = new Map(state.participantGlobalAudioStates);
              newGlobalAudioStates.set(userId, isGlobalAudioMuted);
              return { participantGlobalAudioStates: newGlobalAudioStates };
            });
            
            // Обновляем участников только если нужно (для совместимости)
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
              
              // Обновляем только отдельное состояние глобального звука
              set((state) => {
                const newGlobalAudioStates = new Map(state.participantGlobalAudioStates);
                newGlobalAudioStates.set(userId, isGlobalAudioMuted);
                return { participantGlobalAudioStates: newGlobalAudioStates };
              });
              
              // Обновляем участников только если нужно (для совместимости)
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
          
          // LiveKit doesn't need routerRtpCapabilities or device initialization
          // Audio/video tracks are managed automatically by LiveKit
          
          if (response.existingPeers) {
            // Сохраняем маппинг для существующих пиров
            const newMap = new Map(state.peerIdToUserIdMap);
            response.existingPeers.forEach(peer => {
              const socketId = peer.peerId || peer.id;
              if (socketId && peer.userId) {
                newMap.set(socketId, peer.userId);
                console.log('[VAD] existingPeers: Added mapping', { socketId, userId: peer.userId });
              }
            });
            console.log('[VAD] existingPeers mappings:', Array.from(newMap.entries()));
            
            // Сначала устанавливаем участников без профилей
            set({
              peerIdToUserIdMap: newMap,
              participants: response.existingPeers.map(peer => ({
                userId: peer.userId,
                peerId: peer.peerId || peer.id,
                name: peer.name,
                isMuted: peer.isMuted || false,
                isAudioEnabled: peer.isAudioEnabled !== undefined ? peer.isAudioEnabled : true,
                isGlobalAudioMuted: peer.isGlobalAudioMuted || false, // Добавляем статус глобального звука
                isSpeaking: false,
                avatar: null,
                avatarColor: '#5865f2',
                banner: null
              }))
            });
            
            // Затем асинхронно загружаем профили для всех участников
            Promise.all(response.existingPeers.map(async (peer) => {
              try {
                const profile = await userApi.getProfile(peer.userId);
                if (profile) {
                  // Определяем, является ли banner изображением или цветом
                  const bannerIsImage = isBannerImage(profile.banner);
                  const bannerValue = profile.banner 
                    ? (bannerIsImage ? `${MEDIA_BASE_URL}${profile.banner}` : profile.banner)
                    : null;
                  
                  const profileData = {
                    avatar: profile.avatar ? `${MEDIA_BASE_URL}${profile.avatar}` : null,
                    avatarColor: profile.avatarColor || '#5865f2',
                    banner: bannerValue
                  };
                  
                  // Обновляем участника с данными профиля
                  set((state) => ({
                    participants: state.participants.map(p => 
                      p.userId === peer.userId 
                        ? { ...p, ...profileData }
                        : p
                    )
                  }));
                }
              } catch (error) {
                console.warn('Failed to load profile for existing peer:', peer.userId, error);
              }
            })).catch(error => {
              console.warn('Error loading profiles for existing peers:', error);
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
          
          // Для LiveKit аудио публикуется автоматически при подключении к комнате
          // Но мы все равно инициализируем локальный поток для шумоподавления
          await state.createAudioStream();
          
          // Отправляем начальное состояние микрофона и наушников на сервер
          const currentState = get();
          if (voiceCallApi.socket) {
            // Отправляем состояние микрофона
            voiceCallApi.socket.emit('muteState', { isMuted: currentState.isMuted });
            console.log('📤 Initial mic state sent to server:', currentState.isMuted);
            
            // Отправляем состояние наушников
            voiceCallApi.socket.emit('audioState', { 
              isEnabled: !currentState.isGlobalAudioMuted,
              isGlobalAudioMuted: currentState.isGlobalAudioMuted,
              userId: currentState.currentUserId
            });
            console.log('📤 Initial audio state sent to server:', !currentState.isGlobalAudioMuted);
          }
          
          set({ currentRoomId: roomId, isInCall: true, currentCall: { channelId: roomId, channelName: roomId } });
          
          // Воспроизводим звук подключения для самого пользователя
          audioNotificationManager.playUserJoinedSound().catch(error => {
            console.warn('Failed to play user joined sound for self:', error);
          });
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
          
          // Инициализация Voice Activity Detection (VAD) для удалённого участника
          try {
            const remoteStream = new MediaStream([consumer.track]);
            await get().initializeRemoteVAD(userId, remoteStream, audioContext);
          } catch (vadError) {
            console.warn('[VAD] Failed to initialize remote VAD for user:', userId, vadError);
          }

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
      // Для LiveKit аудио публикуется автоматически при подключении к комнате
      // Этот метод теперь только инициализирует локальный поток и шумоподавление
      createAudioStream: async () => {
        try {
          const state = get();
          
          // Для LiveKit не нужен sendTransport - аудио публикуется автоматически
          // Проверяем, подключены ли мы к LiveKit комнате
          const room = voiceCallApi.getRoom();
          if (!room) {
            console.warn('No LiveKit room available, skipping audio stream creation');
            return;
          }
          
          // Останавливаем старый поток если есть
          if (state.localStream) {
            state.localStream.getTracks().forEach(track => track.stop());
          }
          
          // Очищаем старое шумоподавление (если было инициализировано ранее)
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
          
          // Инициализация Voice Activity Detection (VAD) для локального пользователя
          try {
            await get().initializeLocalVAD(stream, audioContext);
          } catch (vadError) {
            console.warn('[VAD] Failed to initialize local VAD:', vadError);
          }
          
          // Инициализация слушателя состояния говорения от сервера (для удалённых участников)
          try {
            get().initializeSpeakingStateListener();
          } catch (listenerError) {
            console.warn('[VAD] Failed to initialize speaking state listener:', listenerError);
          }
          
          // Получаем обработанный трек (с шумоподавлением, если включено)
          const processedStream = noiseSuppressionManager.getProcessedStream();
          const audioTrack = processedStream ? processedStream.getAudioTracks()[0] : stream.getAudioTracks()[0];
          
          if (!audioTrack) {
            throw new Error('No audio track in stream');
          }
          
          // Устанавливаем состояние микрофона
          audioTrack.enabled = !state.isMuted;
          
          // Если шумоподавление включено по умолчанию, включаем его
          const savedNoiseSuppression = localStorage.getItem('noiseSuppression');
          const isNoiseSuppressed = savedNoiseSuppression ? JSON.parse(savedNoiseSuppression) : false;
          if (isNoiseSuppressed) {
            await noiseSuppressionManager.enable(state.noiseSuppressionMode || 'rnnoise');
            set({ isNoiseSuppressed: true });
            
            // Публикуем обработанный трек в LiveKit
            const processedStream = noiseSuppressionManager.getProcessedStream();
            if (processedStream) {
              const processedTrack = processedStream.getAudioTracks()[0];
              if (processedTrack) {
                try {
                  // Отключаем автоматически опубликованный микрофон
                  await room.localParticipant.setMicrophoneEnabled(false);
                  
                  // Получаем существующую публикацию микрофона
                  const microphonePublication = room.localParticipant.getTrackPublication('microphone');
                  
                  if (microphonePublication && microphonePublication.track) {
                    // Используем replaceTrack на существующем треке (предотвращает утечки памяти)
                    console.log('Replacing existing microphone track with noise suppression using replaceTrack');
                    await microphonePublication.track.replaceTrack(processedTrack);
                    console.log('Audio track with noise suppression replaced via LiveKit');
                  } else {
                    // Если публикации нет, публикуем новый трек
                    console.log('No existing microphone publication, publishing new track with noise suppression');
                    await room.localParticipant.setMicrophoneEnabled(false);
                    await room.localParticipant.publishTrack(processedTrack, {
                      source: Track.Source.Microphone,
                      name: 'microphone'
                    });
                    console.log('Audio track with noise suppression published via LiveKit');
                  }
                  
                  // Включаем микрофон с обработанным треком
                  await room.localParticipant.setMicrophoneEnabled(!state.isMuted);
                } catch (error) {
                  console.warn('Failed to publish processed track via LiveKit:', error);
                  // В случае ошибки используем обычный трек
                  await room.localParticipant.setMicrophoneEnabled(!state.isMuted);
                }
              }
            }
          } else {
            // Для LiveKit публикуем трек через localParticipant
            // LiveKit автоматически публикует микрофон при подключении, но мы можем обновить трек
            try {
              await room.localParticipant.setMicrophoneEnabled(!state.isMuted);
              console.log('Audio track published via LiveKit');
            } catch (error) {
              console.warn('Failed to publish audio track via LiveKit:', error);
            }
          }
          
          console.log('Audio stream created with noise suppression support');
        } catch (error) {
          console.error('Failed to create audio stream:', error);
          set({ error: error.message });
        }
      },
      
      // Переключение микрофона
      toggleMute: async () => {
        const state = get();
        const newMutedState = !state.isMuted;
        
        // Сохраняем состояние в localStorage
        localStorage.setItem('micMuted', JSON.stringify(newMutedState));
        console.log('💾 Mic state saved to localStorage:', newMutedState);
        
        // Use LiveKit API to toggle microphone
        try {
          await voiceCallApi.setMicrophoneEnabled(!newMutedState);
        } catch (error) {
          console.warn('Failed to toggle microphone via LiveKit:', error);
          // Fallback to local track control
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
        }
        
        set({ isMuted: newMutedState });
        
        // Сбрасываем состояние говорения при мьюте
        if (newMutedState) {
          const userId = state.currentUserId;
          if (userId) {
            get().resetSpeakingState(userId);
            // Также принудительно сбрасываем VAD детектор
            const vadDetector = get().localVoiceActivityDetector;
            if (vadDetector && vadDetector.forceReset) {
              vadDetector.forceReset();
            }
            console.log('[VAD] Reset speaking state due to mute for user:', userId);
          }
        }
        
        // Воспроизводим звук мьюта/размьюта (только локально)
        if (newMutedState) {
          audioNotificationManager.playMicMutedSound().catch(error => {
            console.warn('Failed to play mic muted sound:', error);
          });
        } else {
          audioNotificationManager.playMicUnmutedSound().catch(error => {
            console.warn('Failed to play mic unmuted sound:', error);
          });
        }
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
        
        // Сохраняем состояние в localStorage
        localStorage.setItem('audioMuted', JSON.stringify(newMutedState));
        console.log('💾 Audio (headphones) state saved to localStorage:', newMutedState);
        
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
        
        // Обновляем отдельное состояние глобального звука для текущего пользователя
        set((state) => {
          const newGlobalAudioStates = new Map(state.participantGlobalAudioStates);
          newGlobalAudioStates.set(state.currentUserId, newMutedState);
          return { participantGlobalAudioStates: newGlobalAudioStates };
        });
        
        // Также обновляем локального пользователя в списке участников (для совместимости)
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
        
        // Воспроизводим звук глобального мьюта/размьюта (только локально)
        if (newMutedState) {
          audioNotificationManager.playGlobalMutedSound().catch(error => {
            console.warn('Failed to play global muted sound:', error);
          });
        } else {
          audioNotificationManager.playGlobalUnmutedSound().catch(error => {
            console.warn('Failed to play global unmuted sound:', error);
          });
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
            
            // Обновляем состояние микрофона для обработанного трека
            if (state.noiseSuppressionManager) {
              const processedStream = state.noiseSuppressionManager.getProcessedStream();
              const audioTrack = processedStream?.getAudioTracks()[0];
              if (audioTrack) {
                audioTrack.enabled = !state.isMuted;
              }
            }
            
            // Обновляем трек в LiveKit через unpublishTrack и publishTrack
            const room = voiceCallApi.getRoom();
            if (room) {
              const localParticipant = room.localParticipant;
              let trackToPublish = null;
              
              if (newState) {
                // При включении шумоподавления используем обработанный трек
                const processedStream = state.noiseSuppressionManager.getProcessedStream();
                if (processedStream) {
                  trackToPublish = processedStream.getAudioTracks()[0];
                }
              } else {
                // При отключении шумоподавления используем оригинальный трек из localStream
                // Это гарантирует, что мы используем активный трек из getUserMedia
                if (state.localStream) {
                  const originalTrack = state.localStream.getAudioTracks()[0];
                  if (originalTrack && originalTrack.readyState === 'live') {
                    trackToPublish = originalTrack;
                    console.log('Using original track from localStream for LiveKit, readyState:', originalTrack.readyState);
                  } else {
                    console.warn('Original track from localStream is not live (readyState:', originalTrack?.readyState, '), trying noise suppression manager');
                    // Fallback на оригинальный поток из noiseSuppressionManager
                    const originalStream = state.noiseSuppressionManager.getOriginalStream();
                    if (originalStream) {
                      const managerOriginalTrack = originalStream.getAudioTracks()[0];
                      if (managerOriginalTrack && managerOriginalTrack.readyState === 'live') {
                        trackToPublish = managerOriginalTrack;
                        console.log('Using original track from noiseSuppressionManager');
                      } else {
                        // Последний fallback - обработанный поток (passthrough)
                        const processedStream = state.noiseSuppressionManager.getProcessedStream();
                        if (processedStream) {
                          trackToPublish = processedStream.getAudioTracks()[0];
                          console.log('Using processed stream as fallback');
                        }
                      }
                    } else {
                      // Последний fallback - обработанный поток (passthrough)
                      const processedStream = state.noiseSuppressionManager.getProcessedStream();
                      if (processedStream) {
                        trackToPublish = processedStream.getAudioTracks()[0];
                        console.log('Using processed stream as fallback (no original stream)');
                      }
                    }
                  }
                } else {
                  console.warn('localStream not available, trying noise suppression manager');
                  // Fallback на оригинальный поток из noiseSuppressionManager
                  const originalStream = state.noiseSuppressionManager.getOriginalStream();
                  if (originalStream) {
                    const originalTrack = originalStream.getAudioTracks()[0];
                    if (originalTrack && originalTrack.readyState === 'live') {
                      trackToPublish = originalTrack;
                      console.log('Using original track from noiseSuppressionManager');
                    } else {
                      // Последний fallback - обработанный поток (passthrough)
                      const processedStream = state.noiseSuppressionManager.getProcessedStream();
                      if (processedStream) {
                        trackToPublish = processedStream.getAudioTracks()[0];
                        console.log('Using processed stream as fallback');
                      }
                    }
                  } else {
                    // Последний fallback - обработанный поток (passthrough)
                    const processedStream = state.noiseSuppressionManager.getProcessedStream();
                    if (processedStream) {
                      trackToPublish = processedStream.getAudioTracks()[0];
                      console.log('Using processed stream as final fallback');
                    }
                  }
                }
              }
              
              if (trackToPublish) {
                try {
                  const wasMuted = state.isMuted;
                  
                  // Получаем существующую публикацию микрофона
                  const microphonePublication = localParticipant.getTrackPublication('microphone');
                  
                  if (microphonePublication && microphonePublication.track) {
                    // Используем replaceTrack на существующем треке (предотвращает утечки памяти)
                    console.log('Replacing existing microphone track using replaceTrack');
                    await microphonePublication.track.replaceTrack(trackToPublish);
                    console.log('LiveKit track replaced with noise suppression:', newState, 'track readyState:', trackToPublish.readyState);
                  } else {
                    // Если публикации нет, публикуем новый трек
                    console.log('No existing microphone publication, publishing new track');
                    await localParticipant.setMicrophoneEnabled(false);
                    await localParticipant.publishTrack(trackToPublish, {
                      source: Track.Source.Microphone,
                      name: 'microphone'
                    });
                    console.log('LiveKit track published with noise suppression:', newState, 'track readyState:', trackToPublish.readyState);
                  }
                  
                  // Восстанавливаем состояние микрофона
                  await localParticipant.setMicrophoneEnabled(!wasMuted);
                } catch (error) {
                  console.warn('Failed to replace LiveKit track:', error);
                  // В случае ошибки просто включаем микрофон обратно
                  await localParticipant.setMicrophoneEnabled(!state.isMuted);
                }
              } else {
                console.warn('No track available to publish in LiveKit');
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

          // Если шумоподавление включено, переключаем режим
          if (state.isNoiseSuppressed) {
            // Сначала отключаем текущий режим
            await state.noiseSuppressionManager.disable();
            // Затем включаем новый режим
            const success = await state.noiseSuppressionManager.enable(mode);
            if (success) {
              set({ noiseSuppressionMode: mode });
              
              // Обновляем трек в LiveKit
              const room = voiceCallApi.getRoom();
              if (room) {
                const localParticipant = room.localParticipant;
                const processedStream = state.noiseSuppressionManager.getProcessedStream();
                if (processedStream) {
                  const newTrack = processedStream.getAudioTracks()[0];
                  if (newTrack) {
                    try {
                      const wasMuted = state.isMuted;
                      const microphonePublication = localParticipant.getTrackPublication('microphone');
                      
                      if (microphonePublication && microphonePublication.track) {
                        // Используем replaceTrack на существующем треке (предотвращает утечки памяти)
                        console.log('Replacing existing microphone track with new noise suppression mode using replaceTrack');
                        await microphonePublication.track.replaceTrack(newTrack);
                        console.log('LiveKit track replaced with new noise suppression mode:', mode);
                      } else {
                        // Если публикации нет, публикуем новый трек
                        console.log('No existing microphone publication, publishing new track');
                        await localParticipant.setMicrophoneEnabled(false);
                        await localParticipant.publishTrack(newTrack, {
                          source: Track.Source.Microphone,
                          name: 'microphone'
                        });
                        console.log('LiveKit track published with new noise suppression mode:', mode);
                      }
                      
                      // Восстанавливаем состояние микрофона
                      await localParticipant.setMicrophoneEnabled(!wasMuted);
                    } catch (error) {
                      console.warn('Failed to replace LiveKit track:', error);
                      await localParticipant.setMicrophoneEnabled(!state.isMuted);
                    }
                  }
                }
              }
              
              return true;
            }
            return false;
          } else {
            // Если шумоподавление выключено, просто сохраняем режим
            set({ noiseSuppressionMode: mode });
            return true;
          }
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
            voiceCallApi.socket.off('speakingStateChanged');
          }
          
          if (state.localStream) {
            state.localStream.getTracks().forEach(track => track.stop());
          }
          
          // Очистка шумоподавления
          if (state.noiseSuppressionManager) {
            state.noiseSuppressionManager.cleanup();
          }
          
          // Очистка всех Voice Activity Detectors
          get().cleanupAllVAD();
          
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
          
          // Воспроизводим звук отключения для самого пользователя
          audioNotificationManager.playUserLeftSound().catch(error => {
            console.warn('Failed to play user left sound for self:', error);
          });
          
          await voiceCallApi.disconnect();
          
          set({
            isConnected: false,
            isInCall: false,
            currentRoomId: null,
            currentCall: null,
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
          
          // Останавливаем существующую демонстрацию экрана, если есть
          if (state.isScreenSharing) {
            await get().stopScreenShare();
          }

          console.log('Starting screen share via LiveKit...');
          
          // Use LiveKit API to start screen share
          await voiceCallApi.setScreenShareEnabled(true);
          
          // Get the screen share stream from LiveKit room
          const room = voiceCallApi.getRoom();
          if (room) {
            // Listen for local track published event to get the stream
            const handleLocalTrackPublished = (publication) => {
              // Check if it's a screen share track
              const isScreenShare = publication.source === 'screen_share' || 
                                   publication.source === 2; // Track.Source.ScreenShare = 2
              
              if (isScreenShare && publication.track) {
                const stream = new MediaStream([publication.track.mediaStreamTrack]);
                set({ screenShareStream: stream, isScreenSharing: true });
                
                // Handle track ended
                publication.track.on('ended', () => {
                  console.log('Screen sharing stopped by user');
                  get().stopScreenShare();
                });
              }
            };
            
            // Check if screen share track already exists
            room.localParticipant.videoTrackPublications.forEach(publication => {
              const isScreenShare = publication.source === 'screen_share' || 
                                   publication.source === 2;
              if (isScreenShare && publication.track) {
                handleLocalTrackPublished(publication);
              }
            });
            
            // Listen for new screen share tracks
            room.on('LocalTrackPublished', handleLocalTrackPublished);
          }
          
          set({ isScreenSharing: true });

        } catch (error) {
          console.error('Error starting screen share:', error);
          
          // Проверяем, является ли это отменой пользователем
          const isCancelled = error.message && (
            error.message.includes('отменена') || 
            error.message.includes('cancelled') ||
            error.message.includes('canceled') ||
            error.message.includes('Permission denied') ||
            error.name === 'NotAllowedError' ||
            error.name === 'AbortError'
          );
          
          set({ isScreenSharing: false });
          
          // Показываем ошибку только если это не отмена пользователем
          if (!isCancelled) {
            set({ error: 'Failed to start screen sharing: ' + error.message });
          } else {
            console.log('Screen sharing cancelled by user');
          }
        }
      },

      stopScreenShare: async () => {
        console.log('Stopping screen sharing...');

        try {
          const state = get();
          
          // Use LiveKit API to stop screen share
          await voiceCallApi.setScreenShareEnabled(false);

          // Останавливаем поток
          if (state.screenShareStream) {
            state.screenShareStream.getTracks().forEach(track => track.stop());
          }

          // Очищаем состояние
          set({
            screenShareStream: null,
            isScreenSharing: false
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
          console.log('🎥 startVideo state check:', { currentUserId: state.currentUserId });

          console.log('Enabling camera via LiveKit...');
          
          // Use LiveKit API to enable camera
          await voiceCallApi.setCameraEnabled(true);
          
          // Get the camera stream from LiveKit room
          const room = voiceCallApi.getRoom();
          if (room) {
            // Listen for local track published event to get the stream
            const handleLocalTrackPublished = (publication) => {
              // Check if it's a camera track
              const isCamera = publication.source === 'camera' || 
                              publication.source === 1; // Track.Source.Camera = 1
              
              if (isCamera && publication.track) {
                const stream = new MediaStream([publication.track.mediaStreamTrack]);
                set({ cameraStream: stream, isVideoEnabled: true });
                
                // Обновляем отдельное состояние веб-камеры для текущего пользователя
                set((state) => {
                  const newVideoStates = new Map(state.participantVideoStates);
                  newVideoStates.set(state.currentUserId, true);
                  return { participantVideoStates: newVideoStates };
                });
                
                // Handle track ended
                publication.track.on('ended', () => {
                  console.log('Video track ended');
                  get().stopVideo();
                });
              }
            };
            
            // Check if camera track already exists
            room.localParticipant.videoTrackPublications.forEach(publication => {
              const isCamera = publication.source === 'camera' || 
                              publication.source === 1;
              if (isCamera && publication.track) {
                handleLocalTrackPublished(publication);
              }
            });
            
            // Listen for new camera tracks
            room.on(RoomEvent.LocalTrackPublished, handleLocalTrackPublished);
          }
          
          set({ isVideoEnabled: true });

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
        
        // 🔍 ДЕТАЛЬНАЯ ДИАГНОСТИКА АУДИО ДО ОСТАНОВКИ ВЕБКАМЕРЫ
        console.log('🔍🔍🔍 АУДИО ДИАГНОСТИКА ДО ОСТАНОВКИ ВЕБКАМЕРЫ 🔍🔍🔍');
        
        // Проверяем audio producers ДО остановки
        const audioProducersBefore = Array.from(state.producers.values()).filter(p => p.kind === 'audio');
        console.log('🔍 Audio producers ДО остановки вебкамеры:', audioProducersBefore.length);
        audioProducersBefore.forEach(producer => {
          console.log('🔍 Audio producer ДО:', {
            id: producer.id,
            kind: producer.kind,
            closed: producer.closed,
            paused: producer.paused,
            appData: producer.appData
          });
        });
        
        // Проверяем audio consumers ДО остановки
        const audioConsumersBefore = Array.from(state.consumers.values()).filter(c => c.kind === 'audio');
        console.log('🔍 Audio consumers ДО остановки вебкамеры:', audioConsumersBefore.length);
        audioConsumersBefore.forEach(consumer => {
          console.log('🔍 Audio consumer ДО:', {
            id: consumer.id,
            kind: consumer.kind,
            closed: consumer.closed,
            paused: consumer.paused,
            producerPaused: consumer.producerPaused,
            producerId: consumer.producer ? consumer.producer.id : 'NO_PRODUCER',
            producerClosed: consumer.producer ? consumer.producer.closed : 'NO_PRODUCER',
            producerPausedState: consumer.producer ? consumer.producer.paused : 'NO_PRODUCER'
          });
        });
          
          // Use LiveKit API to disable camera
          try {
            await voiceCallApi.setCameraEnabled(false);
            console.log('🎥 Camera disabled via LiveKit');
          } catch (error) {
            console.log('🎥 stopVideo: setCameraEnabled failed:', error.message);
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
            cameraStream: null,
            cameraAudioProducer: null
          });
          
          // Обновляем отдельное состояние веб-камеры для текущего пользователя
          set((state) => {
            const newVideoStates = new Map(state.participantVideoStates);
            newVideoStates.set(state.currentUserId, false);
            return { participantVideoStates: newVideoStates };
          });
          
          console.log('🎥 Video state cleared');
          
          console.log('🎥 Video stopped, but audio should continue working');
          
          // 🔍 ДЕТАЛЬНАЯ ДИАГНОСТИКА АУДИО ПОСЛЕ ОСТАНОВКИ ВЕБКАМЕРЫ
          console.log('🔍🔍🔍 АУДИО ДИАГНОСТИКА ПОСЛЕ ОСТАНОВКИ ВЕБКАМЕРЫ 🔍🔍🔍');
          
          const currentState = get();
          console.log('🔍 Состояние после остановки вебкамеры:', {
            hasAudioStream: !!currentState.audioStream,
            hasLocalStream: !!currentState.localStream,
            audioStreamTracks: currentState.audioStream ? currentState.audioStream.getTracks().length : 0,
            localStreamTracks: currentState.localStream ? currentState.localStream.getTracks().length : 0,
            producersCount: currentState.producers.size,
            consumersCount: currentState.consumers.size
          });
          
          // Проверяем audio producers
          const audioProducers = Array.from(currentState.producers.values()).filter(p => p.kind === 'audio');
          console.log('🔍 Audio producers после остановки вебкамеры:', audioProducers.length);
          audioProducers.forEach(producer => {
            console.log('🔍 Audio producer:', {
              id: producer.id,
              kind: producer.kind,
              closed: producer.closed,
              paused: producer.paused,
              appData: producer.appData
            });
          });
          
          // Проверяем audio consumers
          const audioConsumers = Array.from(currentState.consumers.values()).filter(c => c.kind === 'audio');
          console.log('🔍 Audio consumers после остановки вебкамеры:', audioConsumers.length);
          audioConsumers.forEach(consumer => {
            console.log('🔍 Audio consumer:', {
              id: consumer.id,
              kind: consumer.kind,
              closed: consumer.closed,
              paused: consumer.paused,
              producerPaused: consumer.producerPaused,
              producerId: consumer.producer ? consumer.producer.id : 'NO_PRODUCER',
              producerClosed: consumer.producer ? consumer.producer.closed : 'NO_PRODUCER',
              producerPausedState: consumer.producer ? consumer.producer.paused : 'NO_PRODUCER'
            });
          });
          
          // Проверяем, что основной аудио producer не затронут
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

          // Проверяем состояние consumers
          const finalState = get();
          console.log('🎥 Consumers after video stop:', Array.from(finalState.consumers.keys()));
          console.log('🎥 Consumers count:', finalState.consumers.size);
          finalState.consumers.forEach((consumer, id) => {
            console.log('🎥 Consumer:', id, 'kind:', consumer.kind, 'paused:', consumer.paused, 'producerPaused:', consumer.producerPaused, 'closed:', consumer.closed);
            console.log('🎥 Consumer producer:', consumer.producerId, 'producer closed:', consumer.producer?.closed, 'producer paused:', consumer.producer?.paused);
          });

          // Проверяем состояние producers
          console.log('🎥 Producers after video stop:', Array.from(finalState.producers.keys()));
          console.log('🎥 Producers count:', finalState.producers.size);
          finalState.producers.forEach((producer, id) => {
            console.log('🎥 Producer:', id, 'kind:', producer.kind, 'paused:', producer.paused, 'closed:', producer.closed);
          });

          // Проверяем audio elements
          console.log('🎥 Audio elements count:', finalState.audioElements.size);
          finalState.audioElements.forEach((audioElement, userId) => {
            console.log('🎥 Audio element for user:', userId, 'srcObject:', !!audioElement.srcObject, 'paused:', audioElement.paused, 'muted:', audioElement.muted, 'currentTime:', audioElement.currentTime, 'duration:', audioElement.duration);
            if (audioElement.srcObject) {
              console.log('🎥 Audio element srcObject tracks:', audioElement.srcObject.getTracks().length);
              audioElement.srcObject.getTracks().forEach(track => {
                console.log('🎥 Audio track:', track.label, 'kind:', track.kind, 'enabled:', track.enabled, 'readyState:', track.readyState);
              });
            }
          });

          // Проверяем gain nodes
          console.log('🎥 Gain nodes count:', finalState.gainNodes.size);
          finalState.gainNodes.forEach((gainNode, userId) => {
            console.log('🎥 Gain node for user:', userId, 'gain:', gainNode.gain.value, 'context:', gainNode.context.state);
          });

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
