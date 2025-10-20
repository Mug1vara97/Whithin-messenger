import { useState, useEffect, useCallback } from 'react';
import { io } from 'socket.io-client';
import { Device } from 'mediasoup-client';

export const useSimpleVoiceCall = (userId, userName) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [socket, setSocket] = useState(null);
  const [device, setDevice] = useState(null);

  const connect = useCallback(async () => {
    try {
      console.log(`[useSimpleVoiceCall] Connecting for user ${userName}`);
      
      const newSocket = io('https://whithin.ru', {
        transports: ['websocket'],
        upgrade: false,
        rememberUpgrade: false
      });

      setSocket(newSocket);
      setIsConnected(true);
      
      return newSocket;
    } catch (error) {
      console.error('Failed to connect to voice server:', error);
      throw error;
    }
  }, [userName]);

  const disconnect = useCallback(async () => {
    try {
      console.log(`[useSimpleVoiceCall] Disconnecting for user ${userName}`);
      
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
      
      setIsConnected(false);
    } catch (error) {
      console.error('Failed to disconnect from voice server:', error);
      throw error;
    }
  }, [socket, userName]);

  const joinRoom = useCallback(async (roomId) => {
    try {
      console.log(`[useSimpleVoiceCall] Joining room ${roomId}`);
      
      if (!socket) {
        throw new Error('Not connected to voice server');
      }

      // Инициализация mediasoup устройства
      if (!device) {
        const newDevice = new Device();
        setDevice(newDevice);
      }

      // Здесь можно добавить логику подключения к mediasoup
      // Пока что просто симулируем успешное подключение
      return Promise.resolve();
    } catch (error) {
      console.error('Failed to join room:', error);
      throw error;
    }
  }, [socket, device]);

  const leaveRoom = useCallback(async () => {
    try {
      console.log(`[useSimpleVoiceCall] Leaving room`);
      
      if (socket) {
        socket.emit('leaveRoom');
      }
      
      return Promise.resolve();
    } catch (error) {
      console.error('Failed to leave room:', error);
      throw error;
    }
  }, [socket]);

  const startAudio = useCallback(async () => {
    try {
      console.log(`[useSimpleVoiceCall] Starting audio`);
      setIsAudioEnabled(true);
      return Promise.resolve();
    } catch (error) {
      console.error('Failed to start audio:', error);
      throw error;
    }
  }, []);

  const stopAudio = useCallback(async () => {
    try {
      console.log(`[useSimpleVoiceCall] Stopping audio`);
      setIsAudioEnabled(false);
      return Promise.resolve();
    } catch (error) {
      console.error('Failed to stop audio:', error);
      throw error;
    }
  }, []);

  const toggleMute = useCallback(() => {
    setIsMuted(prev => !prev);
    console.log(`[useSimpleVoiceCall] Toggling mute to ${!isMuted}`);
  }, [isMuted]);

  const toggleAudio = useCallback(() => {
    setIsAudioEnabled(prev => !prev);
    console.log(`[useSimpleVoiceCall] Toggling audio to ${!isAudioEnabled}`);
  }, [isAudioEnabled]);

  // Очистка при размонтировании
  useEffect(() => {
    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, [socket]);

  return {
    isConnected,
    isMuted,
    isAudioEnabled,
    isSpeaking,
    connect,
    disconnect,
    joinRoom,
    leaveRoom,
    startAudio,
    stopAudio,
    toggleMute,
    toggleAudio
  };
};


