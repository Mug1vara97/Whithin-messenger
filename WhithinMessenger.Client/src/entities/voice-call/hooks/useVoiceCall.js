import { useState, useEffect, useRef } from 'react';
import { voiceCallApi } from '../api/voiceCallApi';
import { CALL_STATUS, MEDIA_TYPES } from '../model/types';

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
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [participants, setParticipants] = useState([]);
  const [volume, setVolume] = useState(1.0);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [error, setError] = useState(null);

  const deviceRef = useRef(null);
  const sendTransportRef = useRef(null);
  const recvTransportRef = useRef(null);
  const producersRef = useRef(new Map());
  const consumersRef = useRef(new Map());
  const localStreamRef = useRef(null);

  // Подключение к серверу
  const connect = async () => {
    try {
      setError(null);
      await voiceCallApi.connect(userId, userName);
      setIsConnected(true);
    } catch (error) {
      console.error('Failed to connect:', error);
      setError(error.message);
    }
  };

  // Инициализация устройства
  const initializeDevice = async (routerRtpCapabilities) => {
    try {
      if (!deviceRef.current) {
        deviceRef.current = new Device();
      }

      if (!deviceRef.current.loaded) {
        await deviceRef.current.load({ routerRtpCapabilities });
      }
      console.log('Device initialized');
    } catch (error) {
      console.error('Failed to initialize device:', error);
      setError(error.message);
    }
  };

  // Создание транспортов
  const createTransports = async () => {
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

  // Присоединение к комнате
  const joinRoom = async (roomId) => {
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
      
      // Небольшая задержка перед созданием producer'а
      await new Promise(resolve => setTimeout(resolve, 100));
      await createAudioStream();
    } catch (error) {
      console.error('Failed to join room:', error);
      setError(error.message);
    }
  };

  // Обработка нового producer
  const handleNewProducer = async (producerData) => {
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
            console.log('Audio playback started after delay');
            setAudioBlocked(false);
          } catch (e) {
            console.log('Audio playback still blocked');
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

      await voiceCallApi.resumeConsumer(consumerData.id);
      console.log('New consumer created:', consumerData.id);
    } catch (error) {
      console.error('Failed to handle new producer:', error);
    }
  };

  // Удаление consumer
  const removeConsumer = (producerId) => {
    const consumer = consumersRef.current.get(producerId);
    if (consumer) {
      consumer.close();
      consumersRef.current.delete(producerId);
    }
  };

  // Удаление всех consumer'ов для конкретного peer'а
  const removeConsumerForPeer = (userId) => {
    const consumersToRemove = [];
    consumersRef.current.forEach((consumer, consumerId) => {
      if (consumer.appData && consumer.appData.userId === userId) {
        consumersToRemove.push(consumerId);
      }
    });
    
    consumersToRemove.forEach(consumerId => {
      removeConsumer(consumerId);
    });
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

      await voiceCallApi.leaveRoom();
      await voiceCallApi.disconnect();
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

  // Обработка событий
  useEffect(() => {
    if (!voiceCallApi.socket) return;

    const handlePeerJoined = (peerData) => {
      console.log('Peer joined:', peerData);
      setParticipants(prev => [...prev, {
        userId: peerData.userId,
        name: peerData.name,
        isMuted: peerData.isMuted,
        isSpeaking: false
      }]);
    };

    const handlePeerLeft = (peerData) => {
      console.log('Peer left:', peerData);
      setParticipants(prev => prev.filter(p => p.userId !== peerData.userId));
      removeConsumerForPeer(peerData.userId);
    };

    const handleNewProducerEvent = (producerData) => {
      console.log('New producer event received:', producerData);
      handleNewProducer(producerData);
    };

    const handleProducerClosed = (producerId) => {
      console.log('Producer closed:', producerId);
      const consumer = consumersRef.current.get(producerId);
      if (consumer) {
        consumer.close();
        consumersRef.current.delete(producerId);
      }
    };

    voiceCallApi.on('peerJoined', handlePeerJoined);
    voiceCallApi.on('peerLeft', handlePeerLeft);
    voiceCallApi.on('newProducer', handleNewProducerEvent);
    voiceCallApi.on('producerClosed', handleProducerClosed);

    return () => {
      voiceCallApi.off('peerJoined', handlePeerJoined);
      voiceCallApi.off('peerLeft', handlePeerLeft);
      voiceCallApi.off('newProducer', handleNewProducerEvent);
      voiceCallApi.off('producerClosed', handleProducerClosed);
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