import { useState, useEffect, useCallback, useRef } from 'react';
import { musicBotApi } from '../api/musicBotApi';

export const useMusicBot = (roomId) => {
  const [isBotInRoom, setIsBotInRoom] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentTrack, setCurrentTrack] = useState(null);
  const [queue, setQueue] = useState([]);
  const [botMessage, setBotMessage] = useState(null);
  
  const roomIdRef = useRef(roomId);
  const cleanupRefs = useRef([]);

  useEffect(() => {
    roomIdRef.current = roomId;
  }, [roomId]);

  useEffect(() => {
    if (!roomId) return;

    // Подписка на события бота
    const roomIdStr = String(roomId || '');
    const unsubscribeMessage = musicBotApi.onBotMessage((data) => {
      const dataRoomId = String(data.roomId || '');
      if (dataRoomId === roomIdStr) {
        setBotMessage(data.message);
        
        // Парсим сообщения для извлечения информации о треке и очереди
        if (data.message.includes('Queue')) {
          // Парсим информацию об очереди из сообщения
          const queueMatch = data.message.match(/Queue \((\d+) items\)/);
          if (queueMatch) {
            // Можно попробовать извлечь список треков, но это упрощенная версия
          }
        }
        
        // Очищаем сообщение через 5 секунд
        setTimeout(() => setBotMessage(null), 5000);
      }
    });

    const unsubscribeJoined = musicBotApi.onBotJoined((data) => {
      const dataRoomId = String(data.roomId || '');
      if (dataRoomId === roomIdStr) {
        setIsBotInRoom(true);
        setError(null);
      }
    });

    const unsubscribeLeft = musicBotApi.onBotLeft((data) => {
      const dataRoomId = String(data.roomId || '');
      if (dataRoomId === roomIdStr) {
        setIsBotInRoom(false);
        setCurrentTrack(null);
        setQueue([]);
      }
    });

    cleanupRefs.current = [unsubscribeMessage, unsubscribeJoined, unsubscribeLeft];

    return () => {
      cleanupRefs.current.forEach(cleanup => cleanup());
      cleanupRefs.current = [];
    };
  }, [roomId]);

  const addBot = useCallback(async () => {
    if (!roomId) {
      setError('Room ID is required');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await musicBotApi.addBotToRoom(roomId);
      setIsBotInRoom(true);
    } catch (err) {
      setError(err.message || 'Failed to add bot to room');
      setIsBotInRoom(false);
    } finally {
      setIsLoading(false);
    }
  }, [roomId]);

  const removeBot = useCallback(async () => {
    if (!roomId) {
      setError('Room ID is required');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await musicBotApi.removeBotFromRoom(roomId);
      setIsBotInRoom(false);
      setCurrentTrack(null);
      setQueue([]);
    } catch (err) {
      setError(err.message || 'Failed to remove bot from room');
    } finally {
      setIsLoading(false);
    }
  }, [roomId]);

  const sendCommand = useCallback((command, args = []) => {
    if (!roomId) {
      setError('Room ID is required');
      return;
    }

    try {
      musicBotApi.sendCommand(roomId, command, args);
    } catch (err) {
      setError(err.message || 'Failed to send command');
    }
  }, [roomId]);

  return {
    isBotInRoom,
    currentTrack,
    queue,
    isLoading,
    error,
    botMessage,
    addBot,
    removeBot,
    sendCommand
  };
};
