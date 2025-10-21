import { useState, useEffect, useCallback } from 'react';
import { 
  createVideoCall 
} from '../model';

export const useVideoCall = (participants = []) => {
  const [videoCall, setVideoCall] = useState(() => 
    createVideoCall('1', 'Video Call', [])
  );
  const [focusedParticipantId, setFocusedParticipantId] = useState(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [bottomPage, setBottomPage] = useState(0);
  const [visibleBottomUsers, setVisibleBottomUsers] = useState(6);

  // Обновляем участников при изменении пропса participants
  useEffect(() => {
    setVideoCall(prev => ({
      ...prev,
      participants: participants
    }));
  }, [participants]);

  // Расчет количества видимых участников в нижней панели
  const calculateVisibleUsers = useCallback(() => {
    const containerWidth = window.innerWidth;
    const tileWidth = 200;
    const gap = 10;
    const arrowSpace = 120;
    const containerPadding = 140;
    const totalPadding = arrowSpace + containerPadding;
    
    const availableWidth = containerWidth - totalPadding;
    const maxCount = Math.floor((availableWidth + gap) / (tileWidth + gap));
    
    setVisibleBottomUsers(Math.max(2, Math.min(6, maxCount)));
  }, []);

  useEffect(() => {
    calculateVisibleUsers();
    window.addEventListener('resize', calculateVisibleUsers);
    return () => window.removeEventListener('resize', calculateVisibleUsers);
  }, [calculateVisibleUsers]);

  // Добавление участника
  const addParticipant = useCallback((participant) => {
    setVideoCall(prev => ({
      ...prev,
      participants: [...prev.participants, participant]
    }));
  }, []);

  // Удаление участника
  const removeParticipant = useCallback((participantId) => {
    setVideoCall(prev => ({
      ...prev,
      participants: prev.participants.filter(p => p.id !== participantId)
    }));
    
    // Если удаляем фокусированного участника, сбрасываем фокус
    if (focusedParticipantId === participantId) {
      setFocusedParticipantId(null);
    }
  }, [focusedParticipantId]);

  // Обновление участника
  const updateParticipant = useCallback((participantId, updates) => {
    setVideoCall(prev => ({
      ...prev,
      participants: prev.participants.map(p => 
        p.id === participantId ? { ...p, ...updates } : p
      )
    }));
  }, []);

  // Фокусировка на участнике
  const focusParticipant = useCallback((participantId) => {
    if (focusedParticipantId === participantId) {
      // Повторный клик - выход из режима фокусировки
      setFocusedParticipantId(null);
      setBottomPage(0);
    } else {
      // Фокусировка на новом участнике
      setFocusedParticipantId(participantId);
      setBottomPage(0);
    }
  }, [focusedParticipantId]);

  // Пагинация для обычной сетки
  const goToPage = useCallback((page) => {
    setCurrentPage(page);
  }, []);

  // Пагинация для нижней панели в режиме фокусировки
  const goToBottomPage = useCallback((page) => {
    setBottomPage(page);
  }, []);

  // Сброс страницы при изменении количества видимых участников
  useEffect(() => {
    setBottomPage(0);
  }, [visibleBottomUsers]);

  // Расчет пагинации
  const totalPages = Math.ceil(videoCall.participants.length / 9);
  const totalBottomPages = Math.ceil(videoCall.participants.length / visibleBottomUsers);

  const startIndex = currentPage * 9;
  const endIndex = Math.min(startIndex + 9, videoCall.participants.length);
  const currentParticipants = videoCall.participants.slice(startIndex, endIndex);

  const bottomStartIndex = bottomPage * visibleBottomUsers;
  const bottomEndIndex = Math.min(bottomStartIndex + visibleBottomUsers, videoCall.participants.length);
  const currentBottomParticipants = videoCall.participants.slice(bottomStartIndex, bottomEndIndex);

  return {
    // Состояние
    videoCall,
    focusedParticipantId,
    currentPage,
    bottomPage,
    visibleBottomUsers,
    totalPages,
    totalBottomPages,
    currentParticipants,
    currentBottomParticipants,
    
    // Действия
    addParticipant,
    removeParticipant,
    updateParticipant,
    focusParticipant,
    goToPage,
    goToBottomPage,
    
    // Вычисляемые значения
    isFocusedMode: focusedParticipantId !== null,
    focusedParticipant: videoCall.participants.find(p => p.id === focusedParticipantId)
  };
};
