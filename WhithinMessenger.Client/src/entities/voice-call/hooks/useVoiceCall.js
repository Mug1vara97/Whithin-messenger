import { useState, useEffect, useRef, useCallback } from 'react';
import { voiceCallApi } from '../api/voiceCallApi';
import { CALL_STATUS, MEDIA_TYPES } from '../model/types';
import { ICE_SERVERS } from '../../../shared/lib/constants/iceServers';

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
  const connect = useCallback(async () => {
    try {
      setError(null);
      await voiceCallApi.connect(userId, userName);
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

  // Инициализация устройства
  const initializeDevice = useCallback(async (routerRtpCapabilities) => {
    try {
      deviceRef.current = await voiceCallApi.initializeDevice(routerRtpCapabilities);
      await createTransports();
    } catch (error) {
      console.error('Failed to initialize device:', error);
      setError(error.message);
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
      
      if (response.existingProducers) {
        for (const producer of response.existingProducers) {
          await handleNewProducer(producer);
        }
      }
      
      await createAudioStream();
    } catch (error) {
      console.error('Failed to join room:', error);
      setError(error.message);
    }
  }, [userName, userId, initializeDevice, createAudioStream]);

  // Создание аудио потока
  const createAudioStream = useCallback(async () => {
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
  }, [userId, userName]);

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
          } catch (e) {
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

  // Переключение микрофона
  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
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

  // Обработка событий
  useEffect(() => {
    if (!voiceCallApi.socket) return;

    const handlePeerJoined = (peerData) => {
      setParticipants(prev => [...prev, {
        userId: peerData.userId,
        name: peerData.name,
        isMuted: peerData.isMuted,
        isSpeaking: false
      }]);
    };

    const handlePeerLeft = (peerData) => {
      setParticipants(prev => prev.filter(p => p.userId !== peerData.userId));
    };

    const handleNewProducer = (producerData) => {
      handleNewProducer(producerData);
    };

    const handleProducerClosed = (producerId) => {
      const consumer = consumersRef.current.get(producerId);
      if (consumer) {
        consumer.close();
        consumersRef.current.delete(producerId);
      }
    };

    voiceCallApi.on('peerJoined', handlePeerJoined);
    voiceCallApi.on('peerLeft', handlePeerLeft);
    voiceCallApi.on('newProducer', handleNewProducer);
    voiceCallApi.on('producerClosed', handleProducerClosed);

    return () => {
      voiceCallApi.off('peerJoined', handlePeerJoined);
      voiceCallApi.off('peerLeft', handlePeerLeft);
      voiceCallApi.off('newProducer', handleNewProducer);
      voiceCallApi.off('producerClosed', handleProducerClosed);
    };
  }, [handleNewProducer]);

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