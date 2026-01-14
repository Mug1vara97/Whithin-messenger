import { useState, useEffect, useCallback } from 'react';
import { voiceCallApi } from '../api/voiceCallApi';

export const useSimpleVoiceCall = (userId, userName) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const connect = useCallback(async () => {
    try {
      console.log(`[useSimpleVoiceCall] Connecting for user ${userName}`);
      await voiceCallApi.connect(userId, userName);
      setIsConnected(true);
    } catch (error) {
      console.error('Failed to connect to voice server:', error);
      throw error;
    }
  }, [userId, userName]);

  const disconnect = useCallback(async () => {
    try {
      console.log(`[useSimpleVoiceCall] Disconnecting for user ${userName}`);
      await voiceCallApi.disconnect();
      setIsConnected(false);
    } catch (error) {
      console.error('Failed to disconnect from voice server:', error);
      throw error;
    }
  }, [userName]);

  const joinRoom = useCallback(async (roomId) => {
    try {
      console.log(`[useSimpleVoiceCall] Joining room ${roomId}`);
      await voiceCallApi.joinRoom(roomId, userName, userId);
      return Promise.resolve();
    } catch (error) {
      console.error('Failed to join room:', error);
      throw error;
    }
  }, [userId, userName]);

  const leaveRoom = useCallback(async () => {
    try {
      console.log(`[useSimpleVoiceCall] Leaving room`);
      await voiceCallApi.disconnect();
      return Promise.resolve();
    } catch (error) {
      console.error('Failed to leave room:', error);
      throw error;
    }
  }, []);

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
      voiceCallApi.disconnect().catch(console.error);
    };
  }, []);

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

