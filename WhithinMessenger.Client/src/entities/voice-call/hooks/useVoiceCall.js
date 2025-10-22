import { useState, useRef, useCallback, useEffect } from 'react';
import { voiceCallApi } from '../api/voiceCallApi';
import { NoiseSuppressionManager } from '../../../shared/lib/utils/noiseSuppression';
import useVoiceCallStore from '../../../shared/lib/stores/voiceCallStore';

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
  // Глобальное состояние звонка
  const {
    isInCall,
    isCallMinimized,
    currentRoomId,
    minimizeCall,
    restoreCall,
    joinCall,
    leaveCall
  } = useVoiceCallStore();

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

  const deviceRef = useRef(null);
  const sendTransportRef = useRef(null);
  const recvTransportRef = useRef(null);
  const producersRef = useRef(new Map());
  const consumersRef = useRef(new Map());
  const localStreamRef = useRef(null);
  const handleNewProducerRef = useRef(null);
  const noiseSuppressionRef = useRef(null);
  const audioContextRef = useRef(null);
  const createAudioStreamRef = useRef(null);
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

      voiceCallApi.on('newProducer', async (producerData) => {
        console.log('New producer event received:', producerData);
        if (handleNewProducerRef.current) {
          await handleNewProducerRef.current(producerData);
        }
      });

      voiceCallApi.on('producerClosed', (data) => {
        console.log('Producer closed:', data);
        const producerId = data.producerId || data;
        const producerSocketId = data.producerSocketId;
        
        // Закрываем consumer
        const consumer = consumersRef.current.get(producerId);
        if (consumer) {
          consumer.close();
          consumersRef.current.delete(producerId);
        }
        
        // Если есть producerSocketId, получаем userId из маппинга
        if (producerSocketId) {
          const userId = peerIdToUserIdMapRef.current.get(producerSocketId);
          console.log('Producer closed for socketId:', producerSocketId, 'userId:', userId);
          
          if (userId) {
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
      
      if (sendTransportRef.current) {
        sendTransportRef.current.close();
        sendTransportRef.current = null;
      }
      
      if (recvTransportRef.current) {
        recvTransportRef.current.close();
        recvTransportRef.current = null;
      }
      
      consumersRef.current.forEach(consumer => consumer.close());
      consumersRef.current.clear();
      
      producersRef.current.forEach(producer => producer.close());
      producersRef.current.clear();
      
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
      setParticipants([]);
      setUserVolumes(new Map());
      setUserMutedStates(new Map());
      setShowVolumeSliders(new Map());
      connectingRef.current = false;
      
      // Обновляем состояние в store
      leaveCall();
      
      console.log('Disconnected from voice server');
    } catch (error) {
      console.error('Failed to disconnect:', error);
      connectingRef.current = false;
    }
  }, [leaveCall]);

  // Создание транспортов
  const createTransports = useCallback(async () => {
    try {
      // Создание send transport
      const sendTransportData = await voiceCallApi.createWebRtcTransport();
      sendTransportRef.current = deviceRef.current.createSendTransport({
        id: sendTransportData.id,
        iceParameters: sendTransportData.iceParameters,
        iceCandidates: sendTransportData.iceCandidates,
        dtlsParameters: sendTransportData.dtlsParameters,
        iceServers: ICE_SERVERS
      });

      sendTransportRef.current.on('connect', async ({ dtlsParameters }, callback, errback) => {
        try {
          await voiceCallApi.connectTransport(sendTransportData.id, dtlsParameters);
          callback();
        } catch (error) {
          errback(error);
        }
      });

      sendTransportRef.current.on('produce', async ({ kind, rtpParameters, appData }, callback, errback) => {
        try {
          const { id } = await voiceCallApi.produce(sendTransportData.id, kind, rtpParameters, appData);
          callback({ id });
        } catch (error) {
          errback(error);
        }
      });

      // Создание recv transport
      const recvTransportData = await voiceCallApi.createWebRtcTransport();
      recvTransportRef.current = deviceRef.current.createRecvTransport({
        id: recvTransportData.id,
        iceParameters: recvTransportData.iceParameters,
        iceCandidates: recvTransportData.iceCandidates,
        dtlsParameters: recvTransportData.dtlsParameters,
        iceServers: ICE_SERVERS
      });

      recvTransportRef.current.on('connect', async ({ dtlsParameters }, callback, errback) => {
        try {
          await voiceCallApi.connectTransport(recvTransportData.id, dtlsParameters);
          callback();
        } catch (error) {
          errback(error);
        }
      });

      console.log('Transports created');
    } catch (error) {
      console.error('Failed to create transports:', error);
      setError(error.message);
    }
  }, []);

  // Инициализация устройства
  const initializeDevice = useCallback(async (routerRtpCapabilities) => {
    try {
      deviceRef.current = await voiceCallApi.initializeDevice(routerRtpCapabilities);
      await createTransports();
    } catch (error) {
      console.error('Failed to initialize device:', error);
      setError(error.message);
    }
  }, [createTransports]);

  // Обработка нового producer
  const handleNewProducer = useCallback(async (producerData) => {
    try {
      const consumerData = await voiceCallApi.consume(
        deviceRef.current.rtpCapabilities,
        producerData.producerId,
        recvTransportRef.current.id
      );

      const consumer = await recvTransportRef.current.consume({
        id: consumerData.id,
        producerId: producerData.producerId,
        kind: producerData.kind,
        rtpParameters: consumerData.rtpParameters
      });

      consumersRef.current.set(consumerData.id, consumer);
      
      // Используем userId вместо producerSocketId для ключей
      const socketId = producerData.producerSocketId;
      const userId = peerIdToUserIdMapRef.current.get(socketId) || socketId;
      console.log('handleNewProducer: socketId=', socketId, 'userId=', userId);
      
      // Инициализируем AudioContext если еще не создан
      if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({
          sampleRate: 48000,
          latencyHint: 'interactive'
        });
      }
      
      // Resume audio context if suspended
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }
      
      // Создаем audio element
      const audioElement = document.createElement('audio');
      audioElement.srcObject = new MediaStream([consumer.track]);
      audioElement.autoplay = true;
      audioElement.playsInline = true;
      audioElement.controls = false;
      audioElement.style.display = 'none';
      document.body.appendChild(audioElement);
      
      // Создаем Web Audio API chain: source -> gain
      // НЕ подключаем к destination, чтобы избежать двойного воспроизведения!
      // Воспроизведение идет только через HTML Audio элемент
      const source = audioContextRef.current.createMediaStreamSource(new MediaStream([consumer.track]));
      const gainNode = audioContextRef.current.createGain();
      
      // GainNode больше не используется для воспроизведения, только для отслеживания состояния
      // Устанавливаем начальную громкость HTML Audio элемента
      const initialVolume = userVolumes.get(userId) || 100;
      const isMuted = userMutedStates.get(userId) || false;
      // Если глобально выключен звук, устанавливаем 0, иначе используем индивидуальную громкость
      const audioVolume = isGlobalAudioMuted ? 0 : (isMuted ? 0 : (initialVolume / 100.0));
      audioElement.volume = audioVolume;
      
      // Подключаем source -> gain, но НЕ к destination (только для анализа)
      source.connect(gainNode);
      // gainNode.connect(audioContextRef.current.destination); // ОТКЛЮЧЕНО - используем только HTML Audio
      
      // Сохраняем ссылки
      gainNodesRef.current.set(userId, gainNode);
      audioElementsRef.current.set(userId, audioElement);
      
      // Инициализируем громкость в состоянии если еще не установлена
      if (!userVolumes.has(userId)) {
        setUserVolumes(prev => {
          const newMap = new Map(prev);
          newMap.set(userId, 100);
          return newMap;
        });
      }

      try {
        await audioElement.play();
        console.log('Audio playback started for peer:', userId);
        setAudioBlocked(false);
      } catch (error) {
        console.log('Auto-play blocked, user interaction required:', error);
        setAudioBlocked(true);
        setTimeout(async () => {
          try {
            await audioElement.play();
            setAudioBlocked(false);
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
  }, [userVolumes, userMutedStates, isGlobalAudioMuted]);
  
  // Обновляем ref при изменении handleNewProducer
  handleNewProducerRef.current = handleNewProducer;

  // Создание аудио потока
  const createAudioStream = useCallback(async () => {
    console.log('createAudioStream called with:', { isMuted, isNoiseSuppressed, noiseSuppressionMode });
    try {
      console.log('Creating audio stream...');
      
      // Закрываем старые producers перед созданием нового
      if (producersRef.current.size > 0) {
        console.log('Closing existing producers:', producersRef.current.size);
        producersRef.current.forEach(producer => {
          try {
            producer.close();
          } catch (e) {
            console.warn('Error closing producer:', e);
          }
        });
        producersRef.current.clear();
      }
      
      // Останавливаем старый поток если есть
      if (localStreamRef.current) {
        console.log('Stopping existing local stream');
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
      
      // Очищаем старое шумоподавление
      if (noiseSuppressionRef.current) {
        console.log('Cleaning up existing noise suppression');
        noiseSuppressionRef.current.cleanup();
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

      localStreamRef.current = stream;
      console.log('Got user media stream');
      
      // Инициализация audio context
      if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({
          sampleRate: 48000,
          latencyHint: 'interactive'
        });
        console.log('Created new AudioContext');
      }
      
      // Resume audio context if suspended
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
        console.log('Resumed AudioContext');
      }
      
      // Инициализация шумоподавления
      noiseSuppressionRef.current = new NoiseSuppressionManager();
      await noiseSuppressionRef.current.initialize(stream, audioContextRef.current);
      
      // Получаем обработанный поток
      const processedStream = noiseSuppressionRef.current.getProcessedStream();
      const audioTrack = processedStream.getAudioTracks()[0];
      
      if (!audioTrack) {
        throw new Error('No audio track in processed stream');
      }
      
      // Применяем шумоподавление если оно было включено
      if (isNoiseSuppressed) {
        console.log('Applying noise suppression:', noiseSuppressionMode);
        const enabled = await noiseSuppressionRef.current.enable(noiseSuppressionMode);
        if (!enabled) {
          console.warn('Failed to enable noise suppression, continuing without it');
        }
      }
      
      // Устанавливаем состояние микрофона
      audioTrack.enabled = !isMuted;
      console.log('Audio track muted state:', !audioTrack.enabled);
      
      const producer = await sendTransportRef.current.produce({
        track: audioTrack,
        appData: { userId, userName }
      });

      producersRef.current.set(producer.id, producer);
      console.log('Producer created with ID:', producer.id);
      
      // Устанавливаем producer в noise suppression manager
      if (noiseSuppressionRef.current) {
        noiseSuppressionRef.current.setProducer(producer);
      }
      
      audioTrack.onended = () => {
        console.log('Audio track ended');
      };

      console.log('Audio stream created with noise suppression support');
      return producer;
    } catch (error) {
      console.error('Failed to create audio stream:', error);
      setError(error.message);
    }
  }, [userId, userName, isMuted, isNoiseSuppressed, noiseSuppressionMode]);

  // Обновляем ref при изменении createAudioStream
  createAudioStreamRef.current = createAudioStream;

  // Присоединение к комнате
  const joinRoom = useCallback(async (roomId) => {
    try {
      console.log('joinRoom called for roomId:', roomId);
      console.trace('joinRoom call stack');
      
      // Обновляем состояние в store
      joinCall(roomId);
      
      const response = await voiceCallApi.joinRoom(roomId, userName, userId);
      
      if (response.routerRtpCapabilities) {
        await initializeDevice(response.routerRtpCapabilities);
      }
      
      if (response.existingPeers) {
        // Сохраняем маппинг для существующих пиров
        response.existingPeers.forEach(peer => {
          const socketId = peer.peerId || peer.id;
          if (socketId && peer.userId) {
            peerIdToUserIdMapRef.current.set(socketId, peer.userId);
            console.log('Updated existing peer mapping:', socketId, '->', peer.userId);
          }
        });
        
        console.log('All peer mappings after loading existing peers:', Array.from(peerIdToUserIdMapRef.current.entries()));
        
        setParticipants(response.existingPeers.map(peer => ({
          userId: peer.userId,
          peerId: peer.peerId || peer.id,
          name: peer.name,
          isMuted: peer.isMuted || false,
          isAudioEnabled: peer.isAudioEnabled !== undefined ? peer.isAudioEnabled : true,
          isSpeaking: false
        })));
      }
      
      if (response.existingProducers && response.existingProducers.length > 0) {
        console.log('Processing existing producers:', response.existingProducers);
        for (const producer of response.existingProducers) {
          try {
            await handleNewProducer(producer);
          } catch (error) {
            console.error('Failed to process existing producer:', error);
          }
        }
      }
      
      // Используем ref вместо прямого вызова
      if (createAudioStreamRef.current) {
        await createAudioStreamRef.current();
      }
    } catch (error) {
      console.error('Failed to join room:', error);
      setError(error.message);
    }
  }, [userName, userId, initializeDevice, handleNewProducer, joinCall]); // Убрали createAudioStream из зависимостей

  // Переключение микрофона
  const toggleMute = useCallback(() => {
    const newMutedState = !isMuted;
    
    if (noiseSuppressionRef.current) {
      const processedStream = noiseSuppressionRef.current.getProcessedStream();
      const audioTrack = processedStream?.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !newMutedState;
        setIsMuted(newMutedState);
      }
    } else if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !newMutedState;
        setIsMuted(newMutedState);
      }
    }
    
    // Отправляем состояние мута на сервер
    if (voiceCallApi.socket) {
      voiceCallApi.socket.emit('muteState', { isMuted: newMutedState });
      console.log('Mute state sent to server:', newMutedState);
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
      // НЕ меняем userVolumes, чтобы ползунок остался на месте
    } else {
      // Размутиваем - восстанавливаем звук на текущую позицию ползунка
      const currentVolume = userVolumes.get(peerId) || 100;
      const audioVolume = isGlobalAudioMuted ? 0 : (currentVolume / 100.0);
      audioElement.volume = audioVolume;
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
    
    // Управляем только HTML Audio элементами (GainNode больше не используется для воспроизведения)
    audioElementsRef.current.forEach((audioElement, peerId) => {
      if (audioElement) {
        if (newMutedState) {
          // Мутим HTML Audio элемент
          audioElement.volume = 0;
          console.log(`HTML Audio muted for peer: ${peerId}`);
        } else {
          // Размутиваем с индивидуальной громкостью
          const volume = userVolumes.get(peerId) || 100;
          const isIndividuallyMuted = userMutedStates.get(peerId) || false;
          const audioVolume = isIndividuallyMuted ? 0 : (volume / 100.0);
          audioElement.volume = audioVolume;
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
    
    // Глобальное состояние звонка
    isInCall,
    isCallMinimized,
    currentRoomId,
    
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
    
    // Методы минимизации
    minimizeCall,
    restoreCall
  };
};