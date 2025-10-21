import { useState, useRef, useCallback, useEffect } from 'react';
import { voiceCallApi } from '../api/voiceCallApi';
import { NoiseSuppressionManager } from '../../../shared/lib/utils/noiseSuppression';

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
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
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
      voiceCallApi.off('newProducer');
      voiceCallApi.off('producerClosed');
      
      await voiceCallApi.connect(userId, userName);
      
      // Регистрируем обработчики событий СРАЗУ после подключения
      voiceCallApi.on('peerJoined', (peerData) => {
        console.log('Peer joined:', peerData);
        // Проверяем, нет ли уже такого участника
        setParticipants(prev => {
          const exists = prev.some(p => p.userId === peerData.userId);
          if (exists) {
            console.log('Participant already exists, skipping:', peerData.userId);
            return prev;
          }
          return [...prev, {
          userId: peerData.userId,
          name: peerData.name,
          isMuted: peerData.isMuted,
          isSpeaking: false
          }];
        });
      });

      voiceCallApi.on('peerLeft', (peerData) => {
        console.log('Peer left:', peerData);
        setParticipants(prev => prev.filter(p => p.userId !== peerData.userId));
      });

      voiceCallApi.on('newProducer', async (producerData) => {
        console.log('New producer event received:', producerData);
        if (handleNewProducerRef.current) {
          await handleNewProducerRef.current(producerData);
        }
      });

      voiceCallApi.on('producerClosed', (producerId) => {
        console.log('Producer closed:', producerId);
        const consumer = consumersRef.current.get(producerId);
        if (consumer) {
          consumer.close();
          consumersRef.current.delete(producerId);
        }
      });
      
      setIsConnected(true);
      connectingRef.current = false;
    } catch (error) {
      console.error('Failed to connect to voice server:', error);
      setError(error.message);
      connectingRef.current = false;
    }
  }, [userId, userName]);

  // Отключение от сервера
  const disconnect = useCallback(async () => {
    try {
      console.log('Disconnecting from voice call...');
      
      // Очищаем обработчики событий
      voiceCallApi.off('peerJoined');
      voiceCallApi.off('peerLeft');
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
      
      await voiceCallApi.disconnect();
      setIsConnected(false);
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
      
      const peerId = producerData.producerSocketId;
      
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
      const initialVolume = userVolumes.get(peerId) || 100;
      const isMuted = userMutedStates.get(peerId) || false;
      // Если глобально выключен звук, устанавливаем 0, иначе используем индивидуальную громкость
      const audioVolume = isGlobalAudioMuted ? 0 : (isMuted ? 0 : (initialVolume / 100.0));
      audioElement.volume = audioVolume;
      
      // Подключаем source -> gain, но НЕ к destination (только для анализа)
      source.connect(gainNode);
      // gainNode.connect(audioContextRef.current.destination); // ОТКЛЮЧЕНО - используем только HTML Audio
      
      // Сохраняем ссылки
      gainNodesRef.current.set(peerId, gainNode);
      audioElementsRef.current.set(peerId, audioElement);
      
      // Инициализируем громкость в состоянии если еще не установлена
      if (!userVolumes.has(peerId)) {
        setUserVolumes(prev => {
          const newMap = new Map(prev);
          newMap.set(peerId, 100);
          return newMap;
        });
      }

      try {
        await audioElement.play();
        console.log('Audio playback started for peer:', peerId);
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
      const response = await voiceCallApi.joinRoom(roomId, userName, userId);
      
      if (response.routerRtpCapabilities) {
        await initializeDevice(response.routerRtpCapabilities);
      }
      
      if (response.existingPeers) {
        setParticipants(response.existingPeers.map(peer => ({
          userId: peer.userId,
          name: peer.name,
          isMuted: peer.isMuted,
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
  }, [userName, userId, initializeDevice, handleNewProducer]); // Убрали createAudioStream из зависимостей

  // Переключение микрофона
  const toggleMute = useCallback(() => {
    if (noiseSuppressionRef.current) {
      const processedStream = noiseSuppressionRef.current.getProcessedStream();
      const audioTrack = processedStream?.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    } else if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  }, []);

  // Переключение аудио
  const toggleAudio = useCallback(() => {
    setIsAudioEnabled(!isAudioEnabled);
  }, [isAudioEnabled]);

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
    const audioElement = audioElementsRef.current.get(peerId);
    if (!audioElement) return;

    const isCurrentlyMuted = userMutedStates.get(peerId) || false;
    const newIsMuted = !isCurrentlyMuted;

    if (newIsMuted) {
      // Мутим - сохраняем текущую громкость и устанавливаем 0
      const currentVolume = userVolumes.get(peerId) || 100;
      if (currentVolume > 0) {
        previousVolumesRef.current.set(peerId, currentVolume);
      }
      audioElement.volume = 0;
      setUserVolumes(prev => {
        const newMap = new Map(prev);
        newMap.set(peerId, 0);
        return newMap;
      });
    } else {
      // Размутиваем - восстанавливаем предыдущую громкость, но только если глобально не замучено
      const previousVolume = previousVolumesRef.current.get(peerId) || 100;
      const audioVolume = isGlobalAudioMuted ? 0 : (previousVolume / 100.0);
      audioElement.volume = audioVolume;
      setUserVolumes(prev => {
        const newMap = new Map(prev);
        newMap.set(peerId, previousVolume);
        return newMap;
      });
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
    const audioElement = audioElementsRef.current.get(peerId);
    if (!audioElement) return;

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

  // Глобальное отключение/включение звука всех участников
  const toggleGlobalAudio = useCallback(() => {
    const newMutedState = !isGlobalAudioMuted;
    
    console.log(`toggleGlobalAudio called, new state: ${newMutedState}`);
    console.log(`Audio elements count: ${audioElementsRef.current.size}`);
    
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
    isAudioEnabled,
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
    
    // Методы
    connect,
    disconnect,
    joinRoom,
    toggleMute,
    toggleAudio,
    handleVolumeChange,
    toggleNoiseSuppression,
    changeNoiseSuppressionMode,
    toggleUserMute,
    changeUserVolume,
    toggleVolumeSlider,
    toggleGlobalAudio
  };
};