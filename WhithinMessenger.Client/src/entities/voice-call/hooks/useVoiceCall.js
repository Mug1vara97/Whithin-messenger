import { useState, useEffect, useRef, useCallback } from 'react';
import { voiceCallApi } from '../api/voiceCallApi';
import { CALL_STATUS, MEDIA_TYPES } from '../model/types';
import { ICE_SERVERS } from '../../../shared/lib/constants/iceServers';

export const useVoiceCall = (userId, userName) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState(null);
  const [roomId, setRoomId] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  
  const deviceRef = useRef(null);
  const sendTransportRef = useRef(null);
  const recvTransportRef = useRef(null);
  const producersRef = useRef(new Map());
  const consumersRef = useRef(new Map());
  const localStreamRef = useRef(null);
  const screenStreamRef = useRef(null);

  // Подключение к серверу
  const connect = useCallback(async () => {
    if (isConnected || isConnecting) return;
    
    setIsConnecting(true);
    setError(null);

    try {
      await voiceCallApi.connect(userId, userName);
      setIsConnected(true);
      console.log('Connected to voice server');
    } catch (error) {
      console.error('Failed to connect to voice server:', error);
      setError(error.message);
    } finally {
      setIsConnecting(false);
    }
  }, [userId, userName, isConnected, isConnecting]);

  // Отключение от сервера
  const disconnect = useCallback(async () => {
    if (!isConnected) return;

    try {
      // Очистка всех медиа-потоков
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
        localStreamRef.current = null;
      }

      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(track => track.stop());
        screenStreamRef.current = null;
      }

      // Закрытие всех транспортов
      if (sendTransportRef.current) {
        sendTransportRef.current.close();
        sendTransportRef.current = null;
      }

      if (recvTransportRef.current) {
        recvTransportRef.current.close();
        recvTransportRef.current = null;
      }

      // Очистка producers и consumers
      producersRef.current.clear();
      consumersRef.current.clear();

      await voiceCallApi.disconnect();
      setIsConnected(false);
      setRoomId(null);
      setParticipants([]);
      console.log('Disconnected from voice server');
    } catch (error) {
      console.error('Error disconnecting from voice server:', error);
    }
  }, [isConnected]);

  // Присоединение к комнате
  const joinRoom = useCallback(async (targetRoomId, initialMuted = false, initialAudioEnabled = true) => {
    if (!isConnected) {
      throw new Error('Not connected to voice server');
    }

    try {
      const response = await voiceCallApi.joinRoom(
        targetRoomId,
        userName,
        initialMuted,
        initialAudioEnabled
      );

      setRoomId(targetRoomId);
      setIsMuted(initialMuted);
      setIsAudioEnabled(initialAudioEnabled);

      // Инициализация устройства
      if (!deviceRef.current) {
        deviceRef.current = await voiceCallApi.initializeDevice(response.routerRtpCapabilities);
        
        // Настройка ICE серверов для медиа-устройства
        if (deviceRef.current && deviceRef.current.rtpCapabilities) {
          // Устанавливаем ICE серверы для WebRTC соединений
          deviceRef.current.iceServers = ICE_SERVERS;
        }
      }

      // Создание транспортов
      const sendTransportData = await voiceCallApi.createWebRtcTransport();
      const recvTransportData = await voiceCallApi.createWebRtcTransport();

      // Создание send transport
      sendTransportRef.current = deviceRef.current.createSendTransport({
        id: sendTransportData.id,
        iceParameters: sendTransportData.iceParameters,
        iceCandidates: sendTransportData.iceCandidates,
        dtlsParameters: sendTransportData.dtlsParameters,
        iceServers: ICE_SERVERS
      });

      // Создание recv transport
      recvTransportRef.current = deviceRef.current.createRecvTransport({
        id: recvTransportData.id,
        iceParameters: recvTransportData.iceParameters,
        iceCandidates: recvTransportData.iceCandidates,
        dtlsParameters: recvTransportData.dtlsParameters,
        iceServers: ICE_SERVERS
      });

      // Настройка обработчиков для send transport
      sendTransportRef.current.on('connect', async ({ dtlsParameters }, callback, errback) => {
        try {
          await voiceCallApi.connectTransport(sendTransportData.id, dtlsParameters);
          callback();
        } catch (error) {
          errback(error);
        }
      });

      sendTransportRef.current.on('produce', async ({ kind, rtpParameters }, callback, errback) => {
        try {
          const { id } = await voiceCallApi.produce(sendTransportData.id, kind, rtpParameters);
          callback({ id });
        } catch (error) {
          errback(error);
        }
      });

      // Настройка обработчиков для recv transport
      recvTransportRef.current.on('connect', async ({ dtlsParameters }, callback, errback) => {
        try {
          await voiceCallApi.connectTransport(recvTransportData.id, dtlsParameters);
          callback();
        } catch (error) {
          errback(error);
        }
      });

      // Обработка существующих producers
      for (const producerData of response.existingProducers) {
        await handleExistingProducer(producerData);
      }

      console.log('Joined room:', targetRoomId);
    } catch (error) {
      console.error('Failed to join room:', error);
      throw error;
    }
  }, [isConnected, userName, handleExistingProducer]);

  // Обработка существующего producer
  const handleExistingProducer = useCallback(async (producerData) => {
    try {
      const { producerId } = producerData;
      
      const consumerData = await voiceCallApi.consume(
        deviceRef.current.rtpCapabilities,
        producerId,
        recvTransportRef.current.id
      );

      const consumer = recvTransportRef.current.consume({
        id: consumerData.id,
        producerId: consumerData.producerId,
        kind: consumerData.kind,
        rtpParameters: consumerData.rtpParameters,
        type: consumerData.type,
        producerPaused: consumerData.producerPaused,
        appData: consumerData.appData
      });

      consumersRef.current.set(consumer.id, consumer);

      // Возобновление consumer если он не на паузе
      if (!consumerData.producerPaused) {
        await voiceCallApi.resumeConsumer(consumer.id);
        await consumer.resume();
      }

      // Подключение к аудио элементу
      if (consumer.kind === 'audio') {
        const audioElement = document.createElement('audio');
        audioElement.srcObject = new MediaStream([consumer.track]);
        audioElement.autoplay = true;
        audioElement.volume = 1.0;
        document.body.appendChild(audioElement);
      }

      console.log('Created consumer for existing producer:', producerId);
    } catch (error) {
      console.error('Failed to handle existing producer:', error);
    }
  }, []);

  // Начало аудио потока
  const startAudio = useCallback(async () => {
    if (!sendTransportRef.current || !deviceRef.current) {
      throw new Error('Transport or device not initialized');
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000,
          channelCount: 1
        }
      });

      localStreamRef.current = stream;
      const audioTrack = stream.getAudioTracks()[0];

      const producer = await sendTransportRef.current.produce({
        track: audioTrack,
        appData: { mediaType: 'audio' }
      });

      producersRef.current.set(producer.id, producer);

      // Обработка состояния говорения
      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      analyser.fftSize = 256;
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const checkSpeaking = () => {
        analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((sum, value) => sum + value, 0) / bufferLength;
        const speaking = average > 30; // Порог для определения говорения

        if (speaking !== isSpeaking) {
          setIsSpeaking(speaking);
          voiceCallApi.setSpeaking(speaking);
        }

        if (isAudioEnabled && !isMuted) {
          requestAnimationFrame(checkSpeaking);
        }
      };

      checkSpeaking();

      console.log('Audio stream started');
    } catch (error) {
      console.error('Failed to start audio stream:', error);
      throw error;
    }
  }, [isSpeaking, isAudioEnabled, isMuted]);

  // Остановка аудио потока
  const stopAudio = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }

    // Остановка всех аудио producers
    producersRef.current.forEach((producer, id) => {
      if (producer.kind === 'audio') {
        producer.close();
        producersRef.current.delete(id);
      }
    });

    console.log('Audio stream stopped');
  }, []);

  // Переключение микрофона
  const toggleMute = useCallback(async () => {
    const newMutedState = !isMuted;
    setIsMuted(newMutedState);
    
    if (voiceCallApi.socket) {
      await voiceCallApi.toggleMute(newMutedState);
    }

    // Остановка/возобновление аудио producers
    producersRef.current.forEach((producer) => {
      if (producer.kind === 'audio') {
        if (newMutedState) {
          producer.pause();
        } else {
          producer.resume();
        }
      }
    });
  }, [isMuted]);

  // Переключение аудио
  const toggleAudio = useCallback(async () => {
    const newAudioState = !isAudioEnabled;
    setIsAudioEnabled(newAudioState);
    
    if (voiceCallApi.socket) {
      await voiceCallApi.toggleAudio(newAudioState);
    }

    // Остановка/возобновление всех consumers
    consumersRef.current.forEach((consumer) => {
      if (newAudioState) {
        consumer.resume();
      } else {
        consumer.pause();
      }
    });
  }, [isAudioEnabled]);

  // Начало демонстрации экрана
  const startScreenShare = useCallback(async () => {
    if (!sendTransportRef.current) {
      throw new Error('Transport not initialized');
    }

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 }
        },
        audio: false
      });

      screenStreamRef.current = stream;
      const videoTrack = stream.getVideoTracks()[0];

      const producer = await sendTransportRef.current.produce({
        track: videoTrack,
        appData: { mediaType: 'screen' }
      });

      producersRef.current.set(producer.id, producer);
      setIsScreenSharing(true);

      // Обработка остановки демонстрации экрана
      videoTrack.onended = () => {
        stopScreenShare();
      };

      console.log('Screen sharing started');
    } catch (error) {
      console.error('Failed to start screen sharing:', error);
      throw error;
    }
  }, [stopScreenShare]);

  // Остановка демонстрации экрана
  const stopScreenShare = useCallback(() => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
      screenStreamRef.current = null;
    }

    // Остановка screen sharing producers
    producersRef.current.forEach((producer, id) => {
      if (producer.appData?.mediaType === 'screen') {
        producer.close();
        producersRef.current.delete(id);
        voiceCallApi.stopScreenShare(id);
      }
    });

    setIsScreenSharing(false);
    console.log('Screen sharing stopped');
  }, []);

  // Покидание комнаты
  const leaveRoom = useCallback(async () => {
    if (!roomId) return;

    try {
      // Очистка всех медиа-потоков
      stopAudio();
      stopScreenShare();

      // Закрытие транспортов
      if (sendTransportRef.current) {
        sendTransportRef.current.close();
        sendTransportRef.current = null;
      }

      if (recvTransportRef.current) {
        recvTransportRef.current.close();
        recvTransportRef.current = null;
      }

      // Очистка producers и consumers
      producersRef.current.clear();
      consumersRef.current.clear();

      setRoomId(null);
      setParticipants([]);
      setIsMuted(false);
      setIsAudioEnabled(true);
      setIsVideoEnabled(false);
      setIsScreenSharing(false);
      setIsSpeaking(false);

      console.log('Left room');
    } catch (error) {
      console.error('Failed to leave room:', error);
    }
  }, [roomId, stopAudio, stopScreenShare]);

  // Очистка при размонтировании
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    // Состояние подключения
    isConnected,
    isConnecting,
    error,
    
    // Состояние комнаты
    roomId,
    participants,
    
    // Состояние медиа
    isMuted,
    isAudioEnabled,
    isVideoEnabled,
    isScreenSharing,
    isSpeaking,
    
    // Методы управления
    connect,
    disconnect,
    joinRoom,
    leaveRoom,
    startAudio,
    stopAudio,
    toggleMute,
    toggleAudio,
    startScreenShare,
    stopScreenShare,
    
    // API для прямого доступа
    api: voiceCallApi
  };
};
