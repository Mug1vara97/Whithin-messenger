import { useState, useRef, useCallback, useEffect } from 'react';
import { voiceCallApi } from '../api/voiceCallApi';
import { NoiseSuppressionManager } from '../../../shared/lib/utils/noiseSuppression';

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
  const screenProducerRef = useRef(null);
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
        
        // Очищаем gain node (audio элементов больше нет)
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
      
      // Очистка GainNodes
      gainNodesRef.current.forEach(gainNode => {
        try {
          gainNode.disconnect();
        } catch (e) {
          console.warn('Error disconnecting gain node:', e);
        }
      });
      gainNodesRef.current.clear();
      
      // Очищаем ref-ы
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
      
      // Проверяем, является ли это демонстрацией экрана
      const isScreenShare = producerData.appData?.mediaType === 'screen';
      console.log('handleNewProducer: isScreenShare=', isScreenShare, 'kind=', producerData.kind);
      
      // Для демонстрации экрана обрабатываем только видео (аудио обрабатывается отдельно)
      if (isScreenShare && producerData.kind === 'video') {
        console.log('Screen share video producer detected, skipping audio processing');
        return;
      }
      
      // Для аудио демонстрации экрана создаем отдельный AudioContext
      if (isScreenShare && producerData.kind === 'audio') {
        console.log('Screen share audio producer detected, creating separate audio processing');
        console.log('Screen share audio producer data:', producerData);
        
        // Создаем отдельный AudioContext для демонстрации экрана
        if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
          audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({
            sampleRate: 48000,
            latencyHint: 'playback' // Для демонстрации экрана используем playback
          });
        }
        
        // Resume audio context if suspended
        if (audioContextRef.current.state === 'suspended') {
          await audioContextRef.current.resume();
        }
        
        // Создаем audio element для демонстрации экрана
        const audioElement = document.createElement('audio');
        audioElement.srcObject = new MediaStream([consumer.track]);
        audioElement.autoplay = true;
        audioElement.volume = 1.0; // Полная громкость для демонстрации экрана
        audioElement.muted = false;
        
        // Добавляем в DOM для воспроизведения
        document.body.appendChild(audioElement);
        
        // Сохраняем audio element для демонстрации экрана
        const screenShareAudioKey = `screen-share-${userId}`;
        audioElementsRef.current.set(screenShareAudioKey, audioElement);
        
        console.log('Screen share audio consumer created:', consumerData.id);
        return;
      }
      
      // Инициализируем AudioContext если еще не создан (только для аудио)
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
      
      // ИСПОЛЬЗУЕМ ТОЛЬКО WEB AUDIO API - звук НЕ захватывается при демонстрации экрана
      // Создаем source из MediaStream
      const source = audioContextRef.current.createMediaStreamSource(new MediaStream([consumer.track]));
      const gainNode = audioContextRef.current.createGain();
      
      // Устанавливаем начальную громкость через gain node
      const initialVolume = userVolumes.get(userId) || 100;
      const isMuted = userMutedStates.get(userId) || false;
      const audioVolume = isGlobalAudioMuted ? 0 : (isMuted ? 0 : (initialVolume / 100.0));
      gainNode.gain.value = audioVolume;
      
      // ВАЖНО: Подключаем напрямую к destination (динамики)
      // Это НЕ захватывается при screen sharing!
      source.connect(gainNode);
      gainNode.connect(audioContextRef.current.destination);
      
      // Сохраняем ссылки (audioElement больше не нужен)
      gainNodesRef.current.set(userId, gainNode);
      
      // Инициализируем громкость в состоянии если еще не установлена
      if (!userVolumes.has(userId)) {
        setUserVolumes(prev => {
          const newMap = new Map(prev);
          newMap.set(userId, 100);
          return newMap;
        });
      }

      console.log(`✅ Audio connected via Web Audio API for peer: ${userId}`);
      setAudioBlocked(false);

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
      
      // Обновляем текущий звонок
      setCurrentCall({ channelId: roomId, channelName: roomId });
      console.log('Current call set to:', { channelId: roomId, channelName: roomId });
    } catch (error) {
      console.error('Failed to join room:', error);
      setError(error.message);
    }
  }, [userName, userId, initializeDevice, handleNewProducer]); // Убрали createAudioStream из зависимостей

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
    const gainNode = gainNodesRef.current.get(peerId);
    if (!gainNode) {
      console.error('Gain node not found for peer:', peerId);
      return;
    }

    const isCurrentlyMuted = userMutedStates.get(peerId) || false;
    const newIsMuted = !isCurrentlyMuted;

    if (newIsMuted) {
      // Мутим - устанавливаем gain на 0
      gainNode.gain.value = 0;
    } else {
      // Размутиваем - восстанавливаем громкость
      const currentVolume = userVolumes.get(peerId) || 100;
      const audioVolume = isGlobalAudioMuted ? 0 : (currentVolume / 100.0);
      gainNode.gain.value = audioVolume;
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
    const gainNode = gainNodesRef.current.get(peerId);
    if (!gainNode) {
      console.error('Gain node not found for peer:', peerId);
      return;
    }

    // Устанавливаем громкость через gain node
    const audioVolume = isGlobalAudioMuted ? 0 : (newVolume / 100.0);
    gainNode.gain.value = audioVolume;

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
    console.log(`Gain nodes count: ${gainNodesRef.current.size}`);
    
    // Отправляем состояние наушников на сервер
    // isGlobalAudioMuted=true означает isAudioEnabled=false
    if (voiceCallApi.socket) {
      voiceCallApi.socket.emit('audioState', { isEnabled: !newMutedState });
      console.log('Audio state (headphones) sent to server, isEnabled:', !newMutedState);
    }
    
    // Управляем громкостью через Gain Nodes
    gainNodesRef.current.forEach((gainNode, peerId) => {
      if (gainNode) {
        if (newMutedState) {
          // Мутим - устанавливаем gain на 0
          gainNode.gain.value = 0;
          console.log(`Gain muted for peer: ${peerId}`);
        } else {
          // Размутиваем с индивидуальной громкостью
          const volume = userVolumes.get(peerId) || 100;
          const isIndividuallyMuted = userMutedStates.get(peerId) || false;
          const audioVolume = isIndividuallyMuted ? 0 : (volume / 100.0);
          gainNode.gain.value = audioVolume;
          console.log(`Gain unmuted for peer: ${peerId}, volume: ${audioVolume}`);
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
        console.log('🚀🚀🚀 STARTING SCREEN SHARE FUNCTION CALLED 🚀🚀🚀');
        
        if (!sendTransportRef.current) {
          throw new Error('Transport not ready');
        }

        // Останавливаем существующую демонстрацию экрана, если есть
        if (isScreenSharing) {
          await stopScreenShare();
        }

        console.log('=== STARTING SCREEN SHARE ===');
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
          sampleSize: 16,
          // ВАЖНО: Подавляем захват звука из браузера (включая наш звонок)
          // Системный звук (музыка, видео) всё равно захватится
          suppressLocalAudioPlayback: true
        },
        // Предпочитаем захват всего экрана для захвата системного звука
        preferCurrentTab: false,
        systemAudio: 'include'
      });

      console.log('Screen sharing access granted');

      // Обработка остановки потока пользователем
      stream.getVideoTracks()[0].onended = () => {
        console.log('Screen sharing stopped by user');
        stopScreenShare();
      };

      // Устанавливаем поток
      setScreenShareStream(stream);

      const videoTrack = stream.getVideoTracks()[0];
      const audioTrack = stream.getAudioTracks()[0];
      
      console.log('Stream tracks:', {
        videoTracks: stream.getVideoTracks().length,
        audioTracks: stream.getAudioTracks().length,
        videoTrack: !!videoTrack,
        audioTrack: !!audioTrack
      });
      
      if (!videoTrack) {
        throw new Error('No video track available');
      }

      console.log('Creating screen sharing producers...');
      console.log('Video track:', videoTrack);
      console.log('Audio track:', audioTrack);
      
      // Создаем video producer для демонстрации экрана
      console.log('Creating video producer...');
      const videoProducer = await sendTransportRef.current.produce({
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
          userId: userId,
          userName: userName,
          width: videoTrack.getSettings().width,
          height: videoTrack.getSettings().height,
          frameRate: videoTrack.getSettings().frameRate
        }
      });

      console.log('Screen sharing video producer created:', videoProducer.id);

      // Создаем audio producer для демонстрации экрана, если есть аудио трек
      let audioProducer = null;
      if (audioTrack) {
        console.log('Creating audio producer...');
        audioProducer = await sendTransportRef.current.produce({
          track: audioTrack,
          encodings: [
            {
              ssrc: Math.floor(Math.random() * 4294967296),
              dtx: true,
              maxBitrate: 128000, // 128 kbps для аудио демонстрации экрана
              scalabilityMode: 'S1T1',
              numberOfChannels: 2
            }
          ],
          codecOptions: {
            opusStereo: true,
            opusDtx: true,
            opusFec: true,
            opusNack: true,
            channelsCount: 2,
            sampleRate: 48000,
            opusMaxAverageBitrate: 128000,
            opusMaxPlaybackRate: 48000,
            opusPtime: 20,
            opusApplication: 'music', // Для демонстрации экрана используем music вместо voip
            opusCbr: false,
            opusUseinbandfec: true
          },
          appData: {
            mediaType: 'screen',
            trackType: 'audio',
            userId: userId,
            userName: userName,
            audioProcessing: {
              echoCancellation: false, // Отключаем для демонстрации экрана
              noiseSuppression: false,
              autoGainControl: false,
              highpassFilter: false,
              typingNoiseDetection: false,
              monoAudio: false
            }
          }
        });

        console.log('Screen sharing audio producer created:', audioProducer.id);
      } else {
        console.log('No audio track available for screen sharing');
      }

      // Сохраняем producers
      screenProducerRef.current = { video: videoProducer, audio: audioProducer };
      console.log('Screen sharing producers saved:', { 
        video: videoProducer.id, 
        audio: audioProducer ? audioProducer.id : 'none' 
      });
      setIsScreenSharing(true);

      // Обработка событий video producer
      videoProducer.on('transportclose', () => {
        console.log('Screen sharing video transport closed');
        stopScreenShare();
      });

      videoProducer.on('trackended', () => {
        console.log('Screen sharing video track ended');
        stopScreenShare();
      });

      // Обработка событий audio producer, если он есть
      if (audioProducer) {
        audioProducer.on('transportclose', () => {
          console.log('Screen sharing audio transport closed');
          stopScreenShare();
        });

        audioProducer.on('trackended', () => {
          console.log('Screen sharing audio track ended');
          stopScreenShare();
        });
      }

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
      
      // Очищаем при ошибке
      if (screenShareStream) {
        screenShareStream.getTracks().forEach(track => track.stop());
      }
      setScreenShareStream(null);
      screenProducerRef.current = null;
      setIsScreenSharing(false);
      
      // Показываем ошибку только если это не отмена пользователем
      if (!isCancelled) {
        setError('Failed to start screen sharing: ' + error.message);
      } else {
        console.log('Screen sharing cancelled by user');
      }
    }
  }, [userId, userName, isScreenSharing, screenShareStream, stopScreenShare]);

  const stopScreenShare = useCallback(async () => {
    console.log('Stopping screen sharing...');

    try {
      // Уведомляем сервер об остановке демонстрации экрана
      if (screenProducerRef.current && voiceCallApi.socket) {
        // Останавливаем video producer
        if (screenProducerRef.current.video) {
          await voiceCallApi.stopScreenSharing(screenProducerRef.current.video.id);
        }
        // Останавливаем audio producer, если есть
        if (screenProducerRef.current.audio) {
          await voiceCallApi.stopScreenSharing(screenProducerRef.current.audio.id);
        }
      }

      // Останавливаем поток
      if (screenShareStream) {
        screenShareStream.getTracks().forEach(track => track.stop());
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

      // Логируем состояние audio elements после очистки
      console.log('Audio elements after screen share cleanup:', Array.from(audioElementsRef.current.keys()));

      // Очищаем состояние
      setScreenShareStream(null);
      screenProducerRef.current = null;
      setIsScreenSharing(false);

      console.log('Screen sharing stopped successfully');
    } catch (error) {
      console.error('Error stopping screen share:', error);
      setError('Failed to stop screen sharing: ' + error.message);
    }
  }, [screenShareStream, userId]);

  const toggleScreenShare = useCallback(async () => {
    console.log('🎯🎯🎯 TOGGLE SCREEN SHARE CALLED 🎯🎯🎯', { isScreenSharing });
    console.log('🔥🔥🔥 TOGGLE FUNCTION EXECUTING 🔥🔥🔥');
    console.log('🚀🚀🚀 TOGGLE FUNCTION START 🚀🚀🚀');
    console.log('💥💥💥 TOGGLE FUNCTION MIDDLE 💥💥💥');
    console.log('🎪🎪🎪 TOGGLE FUNCTION END 🎪🎪🎪');
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