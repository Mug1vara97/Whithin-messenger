import { useState, useRef, useCallback, useEffect } from 'react';
import { voiceCallApi } from '../api/voiceCallApi';
import { NoiseSuppressionManager } from '../../../shared/lib/utils/noiseSuppression';
import { RoomEvent, Track } from 'livekit-client';

// 🚨 TEST LOGGING - ДОЛЖНО ПОЯВИТЬСЯ В КОНСОЛИ 🚨
console.log('🔥🔥🔥 useVoiceCall.js LOADED 🔥🔥🔥');

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

export const useVoiceCall = (userId, userName) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaking] = useState(false);
  const [participants, setParticipants] = useState([]);
  const [volume, setVolume] = useState(1.0);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [error, setError] = useState(null);
  const [isNoiseSuppressed, setIsNoiseSuppressed] = useState(() => {
    const saved = localStorage.getItem('noiseSuppression');
    return saved ? JSON.parse(saved) : false;
  });
  const [noiseSuppressionMode, setNoiseSuppressionMode] = useState('rnnoise');
  const [userVolumes, setUserVolumes] = useState(new Map()); // Громкость каждого пользователя
  const [userMutedStates, setUserMutedStates] = useState(new Map()); // Состояние мута для каждого пользователя
  const [showVolumeSliders, setShowVolumeSliders] = useState(new Map()); // Показать слайдер для пользователя
  const [isGlobalAudioMuted, setIsGlobalAudioMuted] = useState(false); // Глобальное отключение звука
  const [currentCall, setCurrentCall] = useState(null); // Текущий активный звонок
  const [isScreenSharing, setIsScreenSharing] = useState(false); // Демонстрация экрана
  const [screenShareStream, setScreenShareStream] = useState(null); // Поток демонстрации экрана

  // LiveKit doesn't need mediasoup refs
  const localStreamRef = useRef(null);
  const noiseSuppressionRef = useRef(null);
  const audioContextRef = useRef(null);
  const screenShareStreamRef = useRef(null);
  const connectingRef = useRef(false);
  const gainNodesRef = useRef(new Map()); // GainNode для каждого пользователя
  const audioElementsRef = useRef(new Map()); // Audio elements для каждого пользователя
  const previousVolumesRef = useRef(new Map()); // Предыдущая громкость перед мутом
  const peerIdToUserIdMapRef = useRef(new Map()); // Маппинг producerSocketId -> userId

  // Подключение к серверу
  const connect = useCallback(async () => {
    try {
      // Предотвращаем множественные одновременные подключения
      if (connectingRef.current) {
        console.log('Connection already in progress, skipping');
        return;
      }
      
      connectingRef.current = true;
      console.log('connect() called');
      console.trace('connect() call stack');
      setError(null);
      
      // Очищаем старые обработчики перед регистрацией новых
      voiceCallApi.off('peerJoined');
      voiceCallApi.off('peerLeft');
      voiceCallApi.off('peerMuteStateChanged');
      voiceCallApi.off('peerAudioStateChanged');
      voiceCallApi.off('newProducer');
      voiceCallApi.off('producerClosed');
      
      await voiceCallApi.connect(userId, userName);
      
      // Регистрируем обработчики событий СРАЗУ после подключения
      voiceCallApi.on('peerJoined', (peerData) => {
        console.log('Peer joined:', peerData);
        // Сохраняем маппинг socketId -> userId
        // peerData.peerId - это socket ID, peerData.userId - это реальный userId
        const socketId = peerData.peerId || peerData.id;
        if (socketId && peerData.userId) {
          peerIdToUserIdMapRef.current.set(socketId, peerData.userId);
          console.log('Updated peer mapping:', socketId, '->', peerData.userId);
          console.log('Current mapping:', Array.from(peerIdToUserIdMapRef.current.entries()));
        }
        // Проверяем, нет ли уже такого участника
        setParticipants(prev => {
          const exists = prev.some(p => p.userId === peerData.userId);
          if (exists) {
            console.log('Participant already exists, skipping:', peerData.userId);
            return prev;
          }
          return [...prev, {
          userId: peerData.userId,
          peerId: socketId, // Socket ID
          name: peerData.name,
          isMuted: peerData.isMuted || false,
          isAudioEnabled: peerData.isAudioEnabled !== undefined ? peerData.isAudioEnabled : true,
          isSpeaking: false
          }];
        });
      });

      voiceCallApi.on('peerLeft', (peerData) => {
        console.log('Peer left:', peerData);
        const socketId = peerData.peerId || peerData.id;
        
        // Получаем userId из маппинга, т.к. в peerData может не быть userId
        const userId = peerData.userId || peerIdToUserIdMapRef.current.get(socketId);
        
        console.log('Peer left - socketId:', socketId, 'userId:', userId);
        
        if (!userId) {
          console.warn('Cannot cleanup peer: userId not found for socketId:', socketId);
          // Все равно удаляем маппинг
          if (socketId) {
            peerIdToUserIdMapRef.current.delete(socketId);
          }
          return;
        }
        
        // Очищаем audio element
        const audioElement = audioElementsRef.current.get(userId);
        if (audioElement) {
          console.log('Removing audio element for user:', userId);
          audioElement.pause();
          audioElement.srcObject = null;
          if (audioElement.parentNode) {
            audioElement.parentNode.removeChild(audioElement);
          }
          audioElementsRef.current.delete(userId);
        }
        
        // Очищаем gain node
        const gainNode = gainNodesRef.current.get(userId);
        if (gainNode) {
          console.log('Disconnecting gain node for user:', userId);
          try {
            gainNode.disconnect();
          } catch (e) {
            console.warn('Error disconnecting gain node:', e);
          }
          gainNodesRef.current.delete(userId);
        }
        
        // Очищаем состояния громкости и мута
        setUserVolumes(prev => {
          const newMap = new Map(prev);
          newMap.delete(userId);
          return newMap;
        });
        
        setUserMutedStates(prev => {
          const newMap = new Map(prev);
          newMap.delete(userId);
          return newMap;
        });
        
        setShowVolumeSliders(prev => {
          const newMap = new Map(prev);
          newMap.delete(userId);
          return newMap;
        });
        
        // Очищаем предыдущие громкости
        previousVolumesRef.current.delete(userId);
        
        // Удаляем маппинг socketId -> userId
        if (socketId) {
          peerIdToUserIdMapRef.current.delete(socketId);
          console.log('Removed peer mapping for:', socketId);
        }
        
        // Удаляем участника из списка
        setParticipants(prev => {
          const filtered = prev.filter(p => p.userId !== userId);
          console.log('Participants after removal:', filtered);
          return filtered;
        });
        
        console.log('Peer cleanup completed for:', userId);
      });

      voiceCallApi.on('peerMuteStateChanged', ({ peerId, isMuted }) => {
        console.log('Peer mute state changed:', { peerId, isMuted });
        // peerId здесь может быть socketId, нужно найти userId
        const userId = peerIdToUserIdMapRef.current.get(peerId) || peerId;
        
        setParticipants(prev => prev.map(p => 
          p.userId === userId ? { ...p, isMuted: Boolean(isMuted), isSpeaking: isMuted ? false : p.isSpeaking } : p
        ));
      });

      voiceCallApi.on('peerAudioStateChanged', (data) => {
        console.log('Peer audio state changed - RAW DATA:', data);
        const { peerId, isAudioEnabled, isEnabled } = data;
        // Поддержка обоих форматов: isAudioEnabled и isEnabled
        const audioEnabled = isAudioEnabled !== undefined ? isAudioEnabled : isEnabled;
        console.log('Peer audio state changed:', { peerId, audioEnabled, isAudioEnabled, isEnabled });
        
        // peerId здесь может быть socketId, нужно найти userId
        const userId = peerIdToUserIdMapRef.current.get(peerId) || peerId;
        console.log('Mapping peerId to userId:', { peerId, userId });
        
        setParticipants(prev => {
          const updated = prev.map(p => {
            if (p.userId === userId) {
              console.log(`Updating participant ${p.userId} audio state to:`, audioEnabled);
              return { ...p, isAudioEnabled: Boolean(audioEnabled) };
            }
            return p;
          });
          console.log('Updated participants:', updated);
          return updated;
        });
      });

      // Handle TrackSubscribed events from LiveKit
      voiceCallApi.on('trackSubscribed', async ({ track, publication, participant, userId, mediaType }) => {
        console.log('🔊 Track subscribed event received:', { 
          trackSid: track?.sid, 
          kind: track?.kind, 
          userId, 
          mediaType,
          hasMediaStreamTrack: !!track?.mediaStreamTrack,
          trackState: track?.mediaStreamTrack?.readyState
        });
        
        // Only handle audio tracks for voice calls
        if (track.kind !== 'audio') {
          console.log('Skipping non-audio track');
          return;
        }
        
        // Skip screen share audio (handled separately if needed)
        if (mediaType === 'screen') {
          console.log('Screen share audio track, skipping standard audio processing');
          return;
        }
        
        // Check if track has mediaStreamTrack
        if (!track.mediaStreamTrack) {
          console.error('Track has no mediaStreamTrack!', track);
          return;
        }
        
        // Use userId from event or fallback to participant identity
        const targetUserId = userId || participant.identity;
        console.log('🔊 Processing audio track for userId:', targetUserId);
        
        // Check if we already have an audio element for this user
        if (audioElementsRef.current.has(targetUserId)) {
          console.log('🔊 Audio element already exists for user:', targetUserId, 'updating...');
          const existingElement = audioElementsRef.current.get(targetUserId);
          existingElement.srcObject = new MediaStream([track.mediaStreamTrack]);
          try {
            await existingElement.play();
            console.log('🔊 Updated audio element playback started');
          } catch (error) {
            console.warn('🔊 Failed to play updated audio element:', error);
          }
          return;
        }
        
        // Initialize AudioContext if needed
        if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
          audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({
            sampleRate: 48000,
            latencyHint: 'interactive'
          });
          console.log('🔊 Created new AudioContext');
        }
        
        // Resume audio context if suspended
        if (audioContextRef.current.state === 'suspended') {
          await audioContextRef.current.resume();
          console.log('🔊 Resumed AudioContext');
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
        console.log('🔊 Created audio element for user:', targetUserId);
        
        // Create Web Audio API chain: source -> gain -> destination
        const source = audioContextRef.current.createMediaStreamSource(mediaStream);
        const gainNode = audioContextRef.current.createGain();
        
        // Set initial volume
        const initialVolume = userVolumes.get(targetUserId) || 100;
        const isMuted = userMutedStates.get(targetUserId) || false;
        const audioVolume = isGlobalAudioMuted ? 0 : (isMuted ? 0 : (initialVolume / 100.0));
        audioElement.volume = audioVolume;
        gainNode.gain.value = audioVolume;
        
        // Connect source -> gain (not to destination to avoid double playback with audio element)
        source.connect(gainNode);
        console.log('🔊 Connected Web Audio API chain (gain node for volume control)');
        
        // Save references
        gainNodesRef.current.set(targetUserId, gainNode);
        audioElementsRef.current.set(targetUserId, audioElement);
        
        // Initialize volume in state if not set
        if (!userVolumes.has(targetUserId)) {
          setUserVolumes(prev => {
            const newMap = new Map(prev);
            newMap.set(targetUserId, 100);
            return newMap;
          });
        }
        
        // Try to play audio element
        try {
          await audioElement.play();
          console.log('🔊✅ Audio playback started for peer:', targetUserId);
          setAudioBlocked(false);
        } catch (error) {
          console.warn('🔊⚠️ Auto-play blocked, user interaction required:', error);
          setAudioBlocked(true);
          // Try again after a delay
          setTimeout(async () => {
            try {
              await audioElement.play();
              console.log('🔊✅ Audio playback started after delay');
              setAudioBlocked(false);
            } catch (err) {
              console.error('🔊❌ Audio playback still blocked:', err);
            }
          }, 1000);
        }
      });
      
      // Keep newProducer for compatibility (but it won't be used with LiveKit)
      voiceCallApi.on('newProducer', async (producerData) => {
        console.log('New producer event received (legacy):', producerData);
        // This is handled by trackSubscribed now
      });

      // Handle producerClosed (track unpublished) for cleanup
      voiceCallApi.on('producerClosed', (data) => {
        console.log('Producer closed (track unpublished):', data);
        const producerSocketId = data.producerSocketId || data.participantIdentity;
        
        // If we have producerSocketId, get userId from mapping
        if (producerSocketId) {
          const userId = peerIdToUserIdMapRef.current.get(producerSocketId) || producerSocketId;
          console.log('Producer closed for socketId:', producerSocketId, 'userId:', userId);
          
          // Only cleanup if it's an audio track (video tracks are handled separately)
          if (data.kind === 'audio' && data.mediaType !== 'screen') {
            // Очищаем audio element
            const audioElement = audioElementsRef.current.get(userId);
            if (audioElement) {
              console.log('Removing audio element for user:', userId);
              audioElement.pause();
              audioElement.srcObject = null;
              if (audioElement.parentNode) {
                audioElement.parentNode.removeChild(audioElement);
              }
              audioElementsRef.current.delete(userId);
            }
            
            // Очищаем gain node
            const gainNode = gainNodesRef.current.get(userId);
            if (gainNode) {
              console.log('Disconnecting gain node for user:', userId);
              try {
                gainNode.disconnect();
              } catch (e) {
                console.warn('Error disconnecting gain node:', e);
              }
              gainNodesRef.current.delete(userId);
            }
            
            // Очищаем состояния
            setUserVolumes(prev => {
              const newMap = new Map(prev);
              newMap.delete(userId);
              return newMap;
            });
            
            setUserMutedStates(prev => {
              const newMap = new Map(prev);
              newMap.delete(userId);
              return newMap;
            });
            
            setShowVolumeSliders(prev => {
              const newMap = new Map(prev);
              newMap.delete(userId);
              return newMap;
            });
            
            previousVolumesRef.current.delete(userId);
            console.log('Audio cleanup completed for userId:', userId);
          }
        }
      });
      
      setIsConnected(true);
      connectingRef.current = false;
      
      // Отправляем начальные состояния на сервер
      if (voiceCallApi.socket) {
        voiceCallApi.socket.emit('muteState', { isMuted: isMuted });
        voiceCallApi.socket.emit('audioState', { isEnabled: !isGlobalAudioMuted });
        console.log('Initial states sent to server - muted:', isMuted, 'audio (headphones on):', !isGlobalAudioMuted);
      }
    } catch (error) {
      console.error('Failed to connect to voice server:', error);
      setError(error.message);
      connectingRef.current = false;
    }
  }, [userId, userName, isMuted, isGlobalAudioMuted]);

  // Отключение от сервера
  const disconnect = useCallback(async () => {
    try {
      console.log('Disconnecting from voice call...');
      
      // Очищаем обработчики событий
      voiceCallApi.off('peerJoined');
      voiceCallApi.off('peerLeft');
      voiceCallApi.off('peerMuteStateChanged');
      voiceCallApi.off('peerAudioStateChanged');
      voiceCallApi.off('newProducer');
      voiceCallApi.off('producerClosed');
      voiceCallApi.off('trackSubscribed');
      console.log('Event handlers cleared');
      
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
        localStreamRef.current = null;
      }
      
      // Очистка шумоподавления
      if (noiseSuppressionRef.current) {
        noiseSuppressionRef.current.cleanup();
        noiseSuppressionRef.current = null;
      }
      
      // Закрытие audio context
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        await audioContextRef.current.close();
        audioContextRef.current = null;
      }
      
      // LiveKit handles cleanup automatically
      
      // Очистка GainNodes и audio elements
      gainNodesRef.current.forEach(gainNode => {
        try {
          gainNode.disconnect();
        } catch (e) {
          console.warn('Error disconnecting gain node:', e);
        }
      });
      gainNodesRef.current.clear();
      
      audioElementsRef.current.forEach(audioElement => {
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
      audioElementsRef.current.clear();
      previousVolumesRef.current.clear();
      peerIdToUserIdMapRef.current.clear();
      
      await voiceCallApi.disconnect();
      setIsConnected(false);
      setCurrentCall(null); // Очищаем текущий звонок
      setParticipants([]);
      setUserVolumes(new Map());
      setUserMutedStates(new Map());
      setShowVolumeSliders(new Map());
      connectingRef.current = false;
      console.log('Disconnected from voice server');
    } catch (error) {
      console.error('Failed to disconnect:', error);
      connectingRef.current = false;
    }
  }, []);

  // LiveKit handles audio/video tracks automatically, no need for mediasoup transports/producers/consumers

  // Присоединение к комнате
  const joinRoom = useCallback(async (roomId, initialMuted = false) => {
    try {
      console.log('joinRoom called for roomId:', roomId);
      const response = await voiceCallApi.joinRoom(roomId, userName, userId, initialMuted);
      
      if (response.existingPeers) {
        // Сохраняем маппинг для существующих пиров
        response.existingPeers.forEach(peer => {
          const socketId = peer.peerId || peer.id;
          if (socketId && peer.userId) {
            peerIdToUserIdMapRef.current.set(socketId, peer.userId);
            console.log('Updated existing peer mapping:', socketId, '->', peer.userId);
          }
        });
        
        setParticipants(response.existingPeers.map(peer => ({
          userId: peer.userId,
          peerId: peer.peerId || peer.id,
          name: peer.name,
          isMuted: peer.isMuted || false,
          isAudioEnabled: peer.isAudioEnabled !== undefined ? peer.isAudioEnabled : true,
          isSpeaking: false
        })));
      }
      
      // Get room and set initial mute state
      const room = voiceCallApi.getRoom();
      if (room) {
        // Set initial microphone state
        await room.localParticipant.setMicrophoneEnabled(!initialMuted);
        setIsMuted(initialMuted);
      }
      
      // Обновляем текущий звонок
      setCurrentCall({ channelId: roomId, channelName: roomId });
      console.log('Current call set to:', { channelId: roomId, channelName: roomId });
    } catch (error) {
      console.error('Failed to join room:', error);
      setError(error.message);
    }
  }, [userName, userId]);

  // Переключение микрофона
  const toggleMute = useCallback(async () => {
    const newMutedState = !isMuted;
    
    try {
      // Use LiveKit API to toggle microphone
      await voiceCallApi.setMicrophoneEnabled(!newMutedState);
      setIsMuted(newMutedState);
    } catch (error) {
      console.error('Error toggling mute:', error);
      setError(error.message);
    }
  }, [isMuted]);


  // Изменение громкости
  const handleVolumeChange = useCallback((newVolume) => {
    setVolume(newVolume);
    const audioElements = document.querySelectorAll('audio');
    audioElements.forEach(audio => {
      audio.volume = newVolume;
    });
  }, []);

  // Переключение мута для отдельного пользователя
  const toggleUserMute = useCallback((peerId) => {
    console.log('toggleUserMute called for:', peerId);
    console.log('Available audio elements:', Array.from(audioElementsRef.current.keys()));
    const audioElement = audioElementsRef.current.get(peerId);
    const gainNode = gainNodesRef.current.get(peerId);
    if (!audioElement) {
      console.error('Audio element not found for peer:', peerId);
      return;
    }

    const isCurrentlyMuted = userMutedStates.get(peerId) || false;
    const newIsMuted = !isCurrentlyMuted;

    if (newIsMuted) {
      // Мутим - устанавливаем 0, НЕ меняя ползунок (сохраняем текущее значение)
      const currentVolume = userVolumes.get(peerId) || 100;
      previousVolumesRef.current.set(peerId, currentVolume);
      audioElement.volume = 0;
      if (gainNode) {
        gainNode.gain.value = 0;
      }
      // НЕ меняем userVolumes, чтобы ползунок остался на месте
    } else {
      // Размутиваем - восстанавливаем звук на текущую позицию ползунка
      const currentVolume = userVolumes.get(peerId) || 100;
      const audioVolume = isGlobalAudioMuted ? 0 : (currentVolume / 100.0);
      audioElement.volume = audioVolume;
      if (gainNode) {
        gainNode.gain.value = audioVolume;
      }
      // НЕ меняем userVolumes, ползунок уже на нужном месте
    }

    setUserMutedStates(prev => {
      const newMap = new Map(prev);
      newMap.set(peerId, newIsMuted);
      return newMap;
    });

    console.log(`User ${peerId} ${newIsMuted ? 'muted' : 'unmuted'}`);
  }, [userVolumes, userMutedStates, isGlobalAudioMuted]);

  // Изменение громкости отдельного пользователя
  const changeUserVolume = useCallback((peerId, newVolume) => {
    console.log('changeUserVolume called for:', peerId, 'newVolume:', newVolume);
    console.log('Available audio elements:', Array.from(audioElementsRef.current.keys()));
    const audioElement = audioElementsRef.current.get(peerId);
    if (!audioElement) {
      console.error('Audio element not found for peer:', peerId);
      return;
    }

    // Если глобально замучено, применяем только состояние, но не звук
    const audioVolume = isGlobalAudioMuted ? 0 : (newVolume / 100.0);
    audioElement.volume = audioVolume;

    setUserVolumes(prev => {
      const newMap = new Map(prev);
      newMap.set(peerId, newVolume);
      return newMap;
    });

    // Если размутиваем через слайдер, обновляем состояние мута
    if (newVolume > 0 && userMutedStates.get(peerId)) {
      setUserMutedStates(prev => {
        const newMap = new Map(prev);
        newMap.set(peerId, false);
        return newMap;
      });
    } else if (newVolume === 0 && !userMutedStates.get(peerId)) {
      setUserMutedStates(prev => {
        const newMap = new Map(prev);
        newMap.set(peerId, true);
        return newMap;
      });
    }

    console.log(`User ${peerId} volume set to ${newVolume}%`);
  }, [userMutedStates, isGlobalAudioMuted]);

  // Переключение отображения слайдера громкости
  const toggleVolumeSlider = useCallback((peerId) => {
    setShowVolumeSliders(prev => {
      const newMap = new Map(prev);
      const currentState = newMap.get(peerId) || false;
      newMap.set(peerId, !currentState);
      return newMap;
    });
  }, []);

  // Глобальное отключение/включение звука всех участников (наушники)
  const toggleGlobalAudio = useCallback(() => {
    const newMutedState = !isGlobalAudioMuted;
    
    console.log(`toggleGlobalAudio called, new state: ${newMutedState}`);
    console.log(`Audio elements count: ${audioElementsRef.current.size}`);
    
    // Отправляем состояние наушников на сервер
    // isGlobalAudioMuted=true означает isAudioEnabled=false
    if (voiceCallApi.socket) {
      voiceCallApi.socket.emit('audioState', { isEnabled: !newMutedState });
      console.log('Audio state (headphones) sent to server, isEnabled:', !newMutedState);
    }
    
    // Управляем HTML Audio элементами и GainNodes
    audioElementsRef.current.forEach((audioElement, peerId) => {
      const gainNode = gainNodesRef.current.get(peerId);
      if (audioElement) {
        if (newMutedState) {
          // Мутим HTML Audio элемент и gainNode
          audioElement.volume = 0;
          if (gainNode) {
            gainNode.gain.value = 0;
          }
          console.log(`HTML Audio muted for peer: ${peerId}`);
        } else {
          // Размутиваем с индивидуальной громкостью
          const volume = userVolumes.get(peerId) || 100;
          const isIndividuallyMuted = userMutedStates.get(peerId) || false;
          const audioVolume = isIndividuallyMuted ? 0 : (volume / 100.0);
          audioElement.volume = audioVolume;
          if (gainNode) {
            gainNode.gain.value = audioVolume;
          }
          console.log(`HTML Audio unmuted for peer: ${peerId}, volume: ${audioVolume}`);
        }
      }
    });
    
    setIsGlobalAudioMuted(newMutedState);
    console.log(`Global audio ${newMutedState ? 'muted' : 'unmuted'}`);
  }, [isGlobalAudioMuted, userVolumes, userMutedStates]);

  // Переключение шумоподавления
  const toggleNoiseSuppression = useCallback(async () => {
    try {
      if (!noiseSuppressionRef.current || !noiseSuppressionRef.current.isInitialized()) {
        console.error('Noise suppression not initialized');
        return false;
      }

      const newState = !isNoiseSuppressed;
      console.log(`Toggling noise suppression: ${isNoiseSuppressed} -> ${newState}`);
      
      let success = false;

      if (newState) {
        success = await noiseSuppressionRef.current.enable(noiseSuppressionMode);
        console.log(`Noise suppression enabled with mode: ${noiseSuppressionMode}, success: ${success}`);
      } else {
        success = await noiseSuppressionRef.current.disable();
        console.log(`Noise suppression disabled, success: ${success}`);
      }

      if (success) {
        setIsNoiseSuppressed(newState);
        localStorage.setItem('noiseSuppression', JSON.stringify(newState));
        
        // Обновляем состояние микрофона для обработанного трека
        if (noiseSuppressionRef.current) {
          const processedStream = noiseSuppressionRef.current.getProcessedStream();
          const audioTrack = processedStream?.getAudioTracks()[0];
          if (audioTrack) {
            audioTrack.enabled = !isMuted;
            console.log(`Updated audio track enabled state: ${audioTrack.enabled}`);
          }
        }
        
        console.log('Noise suppression ' + (newState ? 'enabled' : 'disabled') + ' successfully');
        return true;
      } else {
        console.error('Failed to toggle noise suppression');
        return false;
      }
    } catch (error) {
      console.error('Error toggling noise suppression:', error);
      return false;
    }
  }, [isNoiseSuppressed, noiseSuppressionMode, isMuted]);

  // Изменение режима шумоподавления
  const changeNoiseSuppressionMode = useCallback(async (mode) => {
    try {
      if (!noiseSuppressionRef.current || !noiseSuppressionRef.current.isInitialized()) {
        console.error('Noise suppression not initialized');
        return false;
      }

      console.log(`Changing noise suppression mode from ${noiseSuppressionMode} to ${mode}`);
      
      let success = false;

      if (!isNoiseSuppressed) {
        success = await noiseSuppressionRef.current.enable(mode);
        console.log(`Enabled noise suppression with mode: ${mode}, success: ${success}`);
      } else if (mode !== noiseSuppressionMode) {
        // Если меняем режим при включенном шумоподавлении
        success = await noiseSuppressionRef.current.enable(mode);
        console.log(`Changed mode to: ${mode}, success: ${success}`);
      } else {
        console.log(`Mode ${mode} is already active`);
        return true; // Режим уже установлен
      }

      if (success) {
        setNoiseSuppressionMode(mode);
        setIsNoiseSuppressed(true);
        localStorage.setItem('noiseSuppression', JSON.stringify(true));
        
        // Обновляем состояние микрофона для обработанного трека
        if (noiseSuppressionRef.current) {
          const processedStream = noiseSuppressionRef.current.getProcessedStream();
          const audioTrack = processedStream?.getAudioTracks()[0];
          if (audioTrack) {
            audioTrack.enabled = !isMuted;
            console.log(`Updated audio track enabled state after mode change: ${audioTrack.enabled}`);
          }
        }
        
        console.log('Noise suppression mode changed to:', mode);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error changing noise suppression mode:', error);
      return false;
    }
  }, [isNoiseSuppressed, noiseSuppressionMode, isMuted]);

  // Обработчик изменения настроек шумоподавления из других компонентов
  useEffect(() => {
    const handleNoiseSuppressionChanged = (event) => {
      const { enabled } = event.detail;
      setIsNoiseSuppressed(enabled);
      
      // Если шумоподавление включено и у нас есть поток, включаем его
      if (enabled && noiseSuppressionRef.current) {
        noiseSuppressionRef.current.enable(noiseSuppressionMode);
      } else if (!enabled && noiseSuppressionRef.current) {
        noiseSuppressionRef.current.disable();
      }
    };

    window.addEventListener('noiseSuppressionChanged', handleNoiseSuppressionChanged);
    return () => {
      window.removeEventListener('noiseSuppressionChanged', handleNoiseSuppressionChanged);
    };
  }, [noiseSuppressionMode]);

  // Демонстрация экрана
  const startScreenShare = useCallback(async () => {
    try {
      console.log('Starting screen share...');
      
      // Останавливаем существующую демонстрацию экрана, если есть
      if (isScreenSharing) {
        await stopScreenShare();
      }

      // Use LiveKit API to start screen share
      await voiceCallApi.setScreenShareEnabled(true);
      
      // Get the screen share stream from LiveKit room
      const room = voiceCallApi.getRoom();
      if (room) {
        // Listen for local track published event to get the stream
        const handleLocalTrackPublished = (publication) => {
          // Check if it's a screen share track
          const isScreenShare = publication.source === Track.Source.ScreenShare || 
                               publication.source === 'screen_share';
          
          if (isScreenShare && publication.track) {
            const stream = new MediaStream([publication.track.mediaStreamTrack]);
            setScreenShareStream(stream);
            screenShareStreamRef.current = stream;
            
            // Handle track ended
            publication.track.on('ended', () => {
              console.log('Screen sharing stopped by user');
              stopScreenShare();
            });
          }
        };
        
        // Check if screen share track already exists
        room.localParticipant.videoTrackPublications.forEach(publication => {
          const isScreenShare = publication.source === Track.Source.ScreenShare || 
                               publication.source === 'screen_share';
          if (isScreenShare && publication.track) {
            handleLocalTrackPublished(publication);
          }
        });
        
        // Listen for new screen share tracks
        room.on(RoomEvent.LocalTrackPublished, handleLocalTrackPublished);
      }
      
      setIsScreenSharing(true);
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
      
      setIsScreenSharing(false);
      
      // Показываем ошибку только если это не отмена пользователем
      if (!isCancelled) {
        setError('Failed to start screen sharing: ' + error.message);
      } else {
        console.log('Screen sharing cancelled by user');
      }
    }
  }, [isScreenSharing, stopScreenShare]);

  const stopScreenShare = useCallback(async () => {
    console.log('Stopping screen sharing...');

    try {
      // Use LiveKit API to stop screen share
      await voiceCallApi.setScreenShareEnabled(false);

      // Останавливаем поток
      if (screenShareStreamRef.current) {
        screenShareStreamRef.current.getTracks().forEach(track => track.stop());
      }

      // Очищаем audio elements для демонстрации экрана
      const screenShareAudioKey = `screen-share-${userId}`;
      const screenShareAudioElement = audioElementsRef.current.get(screenShareAudioKey);
      if (screenShareAudioElement) {
        console.log('Removing screen share audio element for user:', userId);
        screenShareAudioElement.pause();
        screenShareAudioElement.srcObject = null;
        if (screenShareAudioElement.parentNode) {
          screenShareAudioElement.parentNode.removeChild(screenShareAudioElement);
        }
        audioElementsRef.current.delete(screenShareAudioKey);
      }

      // Очищаем состояние
      setScreenShareStream(null);
      screenShareStreamRef.current = null;
      setIsScreenSharing(false);

      console.log('Screen sharing stopped successfully');
    } catch (error) {
      console.error('Error stopping screen share:', error);
      setError('Failed to stop screen sharing: ' + error.message);
    }
  }, [userId]);

  const toggleScreenShare = useCallback(async () => {
    if (isScreenSharing) {
      await stopScreenShare();
    } else {
      await startScreenShare();
    }
  }, [isScreenSharing, startScreenShare, stopScreenShare]);

  return {
    // Состояние
    isConnected,
    isMuted,
    isAudioEnabled: !isGlobalAudioMuted, // Для обратной совместимости: isAudioEnabled означает "наушники включены"
    isSpeaking,
    participants,
    volume,
    audioBlocked,
    error,
    isNoiseSuppressed,
    noiseSuppressionMode,
    userVolumes,
    userMutedStates,
    showVolumeSliders,
    isGlobalAudioMuted,
    currentCall,
    isScreenSharing,
    screenShareStream,
    
    // Методы
    connect,
    disconnect,
    joinRoom,
    toggleMute,
    handleVolumeChange,
    toggleNoiseSuppression,
    changeNoiseSuppressionMode,
    toggleUserMute,
    changeUserVolume,
    toggleVolumeSlider,
    toggleGlobalAudio,
    startScreenShare,
    stopScreenShare,
    toggleScreenShare
  };
};