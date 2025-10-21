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

  const deviceRef = useRef(null);
  const sendTransportRef = useRef(null);
  const recvTransportRef = useRef(null);
  const producersRef = useRef(new Map());
  const consumersRef = useRef(new Map());
  const localStreamRef = useRef(null);
  const handleNewProducerRef = useRef(null);
  const noiseSuppressionRef = useRef(null);
  const audioContextRef = useRef(null);

  // Подключение к серверу
  const connect = useCallback(async () => {
    try {
      setError(null);
      await voiceCallApi.connect(userId, userName);
      
      // Регистрируем обработчики событий СРАЗУ после подключения
      voiceCallApi.on('peerJoined', (peerData) => {
        console.log('Peer joined:', peerData);
        setParticipants(prev => [...prev, {
          userId: peerData.userId,
          name: peerData.name,
          isMuted: peerData.isMuted,
          isSpeaking: false
        }]);
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
    } catch (error) {
      console.error('Failed to connect to voice server:', error);
      setError(error.message);
    }
  }, [userId, userName]);

  // Отключение от сервера
  const disconnect = useCallback(async () => {
    try {
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
      
      await voiceCallApi.disconnect();
      setIsConnected(false);
      setParticipants([]);
    } catch (error) {
      console.error('Failed to disconnect:', error);
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
      
      // Создание аудио элемента
      const audioElement = document.createElement('audio');
      audioElement.srcObject = new MediaStream([consumer.track]);
      audioElement.volume = volume;
      audioElement.autoplay = true;
      audioElement.playsInline = true;
      audioElement.controls = false;
      audioElement.style.display = 'none';
      document.body.appendChild(audioElement);

      try {
        await audioElement.play();
        console.log('Audio playback started for consumer:', consumerData.id);
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
  }, [volume]);
  
  // Обновляем ref при изменении handleNewProducer
  handleNewProducerRef.current = handleNewProducer;

  // Создание аудио потока
  const createAudioStream = useCallback(async () => {
    try {
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
      
      // Инициализация audio context
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
        const enabled = await noiseSuppressionRef.current.enable(noiseSuppressionMode);
        if (!enabled) {
          console.warn('Failed to enable noise suppression, continuing without it');
        }
      }
      
      // Устанавливаем состояние микрофона
      audioTrack.enabled = !isMuted;
      
      const producer = await sendTransportRef.current.produce({
        track: audioTrack,
        appData: { userId, userName }
      });

      producersRef.current.set(producer.id, producer);
      
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

  // Присоединение к комнате
  const joinRoom = useCallback(async (roomId) => {
    try {
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
      
      await createAudioStream();
    } catch (error) {
      console.error('Failed to join room:', error);
      setError(error.message);
    }
  }, [userName, userId, initializeDevice, createAudioStream, handleNewProducer]);

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

  // Переключение шумоподавления
  const toggleNoiseSuppression = useCallback(async () => {
    try {
      if (!noiseSuppressionRef.current || !noiseSuppressionRef.current.isInitialized()) {
        console.error('Noise suppression not initialized');
        return false;
      }

      const newState = !isNoiseSuppressed;
      let success = false;

      if (newState) {
        success = await noiseSuppressionRef.current.enable(noiseSuppressionMode);
      } else {
        success = await noiseSuppressionRef.current.disable();
      }

      if (success) {
        setIsNoiseSuppressed(newState);
        localStorage.setItem('noiseSuppression', JSON.stringify(newState));
        console.log('Noise suppression ' + (newState ? 'enabled' : 'disabled'));
        return true;
      } else {
        console.error('Failed to toggle noise suppression');
        return false;
      }
    } catch (error) {
      console.error('Error toggling noise suppression:', error);
      return false;
    }
  }, [isNoiseSuppressed, noiseSuppressionMode]);

  // Изменение режима шумоподавления
  const changeNoiseSuppressionMode = useCallback(async (mode) => {
    try {
      if (!noiseSuppressionRef.current || !noiseSuppressionRef.current.isInitialized()) {
        console.error('Noise suppression not initialized');
        return false;
      }

      let success = false;

      if (!isNoiseSuppressed) {
        success = await noiseSuppressionRef.current.enable(mode);
      } else if (mode !== noiseSuppressionMode) {
        // Если меняем режим при включенном шумоподавлении
        success = await noiseSuppressionRef.current.enable(mode);
      } else {
        return true; // Режим уже установлен
      }

      if (success) {
        setNoiseSuppressionMode(mode);
        setIsNoiseSuppressed(true);
        localStorage.setItem('noiseSuppression', JSON.stringify(true));
        console.log('Noise suppression mode changed to:', mode);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error changing noise suppression mode:', error);
      return false;
    }
  }, [isNoiseSuppressed, noiseSuppressionMode]);

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
    
    // Методы
    connect,
    disconnect,
    joinRoom,
    toggleMute,
    toggleAudio,
    handleVolumeChange,
    toggleNoiseSuppression,
    changeNoiseSuppressionMode
  };
};