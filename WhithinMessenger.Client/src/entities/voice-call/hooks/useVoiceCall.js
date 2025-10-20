import { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import { Device } from 'mediasoup-client';

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

  const socketRef = useRef(null);
  const deviceRef = useRef(null);
  const sendTransportRef = useRef(null);
  const recvTransportRef = useRef(null);
  const producersRef = useRef(new Map());
  const consumersRef = useRef(new Map());
  const localStreamRef = useRef(null);

  // Вспомогательная функция для отправки событий (как в рабочем примере)
  const socketEmit = useCallback((event, data) => {
    return new Promise((resolve, reject) => {
      if (!socketRef.current) {
        reject(new Error('Socket not connected'));
        return;
      }

      socketRef.current.emit(event, data, (response) => {
        if (response && response.error) {
          reject(new Error(response.error));
        } else {
          resolve(response);
        }
      });
    });
  }, []);

  // Инициализация mediasoup устройства
  const initializeDevice = async (routerRtpCapabilities) => {
    try {
      if (!deviceRef.current) {
        deviceRef.current = new Device();
      }

      if (!deviceRef.current.loaded) {
        await deviceRef.current.load({ routerRtpCapabilities });
      }

      console.log('Device initialized');
      await createTransports();
    } catch (error) {
      console.error('Failed to initialize device:', error);
      setError(error.message);
    }
  };

  // Создание транспортов
  const createTransports = async () => {
    try {
      // Создание send transport
      const sendTransportData = await socketEmit('createWebRtcTransport', {});

      sendTransportRef.current = deviceRef.current.createSendTransport({
        id: sendTransportData.id,
        iceParameters: sendTransportData.iceParameters,
        iceCandidates: sendTransportData.iceCandidates,
        dtlsParameters: sendTransportData.dtlsParameters,
        iceServers: ICE_SERVERS
      });

      sendTransportRef.current.on('connect', async ({ dtlsParameters }, callback, errback) => {
        try {
          await socketEmit('connectTransport', {
            transportId: sendTransportData.id,
            dtlsParameters
          });
          callback();
        } catch (error) {
          errback(error);
        }
      });

      sendTransportRef.current.on('produce', async ({ kind, rtpParameters, appData }, callback, errback) => {
        try {
          const { id } = await socketEmit('produce', {
            transportId: sendTransportData.id,
            kind,
            rtpParameters,
            appData
          });
          callback({ id });
        } catch (error) {
          errback(error);
        }
      });

      // Создание recv transport
      const recvTransportData = await socketEmit('createWebRtcTransport', {});

      recvTransportRef.current = deviceRef.current.createRecvTransport({
        id: recvTransportData.id,
        iceParameters: recvTransportData.iceParameters,
        iceCandidates: recvTransportData.iceCandidates,
        dtlsParameters: recvTransportData.dtlsParameters,
        iceServers: ICE_SERVERS
      });

      recvTransportRef.current.on('connect', async ({ dtlsParameters }, callback, errback) => {
        try {
          await socketEmit('connectTransport', {
            transportId: recvTransportData.id,
            dtlsParameters
          });
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
  };

  // Создание аудио потока
  const createAudioStream = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000,
          channelCount: 2,
          latency: 0,
          suppressLocalAudioPlayback: true
        }
      });

      localStreamRef.current = stream;
      
      const audioTrack = stream.getAudioTracks()[0];
      const producer = await sendTransportRef.current.produce({
        track: audioTrack,
        appData: { userId, userName }
      });

      producersRef.current.set(producer.id, producer);
      
      audioTrack.onended = () => {
        console.log('Audio track ended');
      };

      console.log('Audio stream created');
      return producer;
    } catch (error) {
      console.error('Failed to create audio stream:', error);
      setError(error.message);
    }
  };

  // Обработка нового producer
  const handleNewProducer = useCallback(async (producerData) => {
    try {
      console.log('Handling new producer:', producerData);
      
      const consumerData = await socketEmit('consume', {
        rtpCapabilities: deviceRef.current.rtpCapabilities,
        remoteProducerId: producerData.producerId,
        transportId: recvTransportRef.current.id
      });

      console.log('Consumer data received:', consumerData);

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
            console.log('Audio playback started after delay');
            setAudioBlocked(false);
          } catch (playError) {
            console.log('Audio playback still blocked:', playError);
          }
        }, 1000);
      }

      audioElement.addEventListener('loadedmetadata', () => {
        console.log('Audio metadata loaded for consumer:', consumerData.id);
      });

      audioElement.addEventListener('canplay', () => {
        console.log('Audio can play for consumer:', consumerData.id);
        audioElement.play().catch(e => console.log('Play failed:', e));
      });

      audioElement.addEventListener('error', (e) => {
        console.error('Audio element error:', e);
      });

      await socketEmit('resumeConsumer', { consumerId: consumerData.id });
      console.log('New consumer created:', consumerData.id);
    } catch (error) {
      console.error('Failed to handle new producer:', error);
    }
  }, [socketEmit, volume]);

  // Удаление consumer
  const removeConsumer = (producerId) => {
    const consumer = consumersRef.current.get(producerId);
    if (consumer) {
      consumer.close();
      consumersRef.current.delete(producerId);
    }
  };

  // Удаление всех consumer'ов для конкретного peer'а
  const removeConsumerForPeer = useCallback((userId) => {
    const consumersToRemove = [];
    consumersRef.current.forEach((consumer, consumerId) => {
      if (consumer.appData && consumer.appData.userId === userId) {
        consumersToRemove.push(consumerId);
      }
    });
    
    consumersToRemove.forEach(consumerId => {
      removeConsumer(consumerId);
    });
  }, []);

  // Присоединение к комнате
  const joinRoom = async (roomId) => {
    try {
      const response = await socketEmit('join', {
        roomId: roomId,
        name: userName,
        userId: userId,
        initialMuted: false,
        initialAudioEnabled: true
      });
      
      console.log('Joined room:', roomId, response);
      
      // Инициализация устройства с полученными RTP capabilities
      if (response.routerRtpCapabilities) {
        await initializeDevice(response.routerRtpCapabilities);
      }
      
      // Обработка существующих участников
      if (response.existingPeers) {
        setParticipants(response.existingPeers.map(peer => ({
          userId: peer.userId,
          name: peer.name,
          isMuted: peer.isMuted,
          isSpeaking: false
        })));
      }
      
      // Обработка существующих producer'ов
      if (response.existingProducers) {
        console.log('Processing existing producers:', response.existingProducers);
        for (const producer of response.existingProducers) {
          await handleNewProducer(producer);
        }
      }
      
      // Создание аудио потока
      await createAudioStream();
      
    } catch (error) {
      console.error('Failed to join room:', error);
      setError(error.message);
    }
  };

  // Подключение к серверу
  const connect = async () => {
    try {
      console.log('Connecting to voice server...');
      
      const socket = io('https://whithin.ru', {
        transports: ['websocket'],
        upgrade: false,
        rememberUpgrade: false
      });

      socketRef.current = socket;

      socket.on('connect', () => {
        console.log('Voice call connection established');
        setIsConnected(true);
      });

      socket.on('disconnect', () => {
        console.log('Disconnected from voice server');
        setIsConnected(false);
      });

      socket.on('connect_error', (error) => {
        console.error('Connection error:', error);
        setError(error.message);
      });

      // Обработчики событий
      socket.on('peerJoined', (peerData) => {
        console.log('Peer joined:', peerData);
        setParticipants(prev => [...prev, {
          userId: peerData.userId,
          name: peerData.name,
          isMuted: peerData.isMuted,
          isSpeaking: false
        }]);
      });

      socket.on('peerLeft', (peerData) => {
        console.log('Peer left:', peerData);
        setParticipants(prev => prev.filter(p => p.userId !== peerData.userId));
        removeConsumerForPeer(peerData.userId);
      });

      socket.on('newProducer', async (producerData) => {
        console.log('New producer:', producerData);
        await handleNewProducer(producerData);
      });

      socket.on('producerClosed', (producerId) => {
        console.log('Producer closed:', producerId);
        removeConsumer(producerId);
      });

      setError(null);
    } catch (error) {
      console.error('Failed to connect:', error);
      setError(error.message);
    }
  };

  // Отключение
  const disconnect = async () => {
    try {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
      producersRef.current.forEach(producer => producer.close());
      consumersRef.current.forEach(consumer => consumer.close());
      sendTransportRef.current?.close();
      recvTransportRef.current?.close();
      producersRef.current.clear();
      consumersRef.current.clear();
      localStreamRef.current = null;
      sendTransportRef.current = null;
      recvTransportRef.current = null;

      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      
      setIsConnected(false);
      setParticipants([]);
    } catch (error) {
      console.error('Failed to disconnect:', error);
    }
  };

  // Переключение микрофона
  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  // Переключение аудио
  const toggleAudio = () => {
    setIsAudioEnabled(!isAudioEnabled);
  };

  // Изменение громкости
  const handleVolumeChange = (event, newValue) => {
    setVolume(newValue);
    const audioElements = document.querySelectorAll('audio');
    audioElements.forEach(audio => {
      audio.volume = newValue;
    });
  };

  // Очистка при размонтировании
  useEffect(() => {
    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

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
    
    // Методы
    connect,
    disconnect,
    joinRoom,
    toggleMute,
    toggleAudio,
    handleVolumeChange
  };
};
