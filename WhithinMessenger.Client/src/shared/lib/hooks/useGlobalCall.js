import { useCall } from '../contexts/CallContext';

/**
 * Хук для работы с глобальным состоянием звонков
 * Использует CallContext для доступа к глобальному состоянию звонков
 */
export const useGlobalCall = (userId = null, userName = null) => {
  const callContext = useCall();
  
  // Используем переданного пользователя
  const user = userId && userName ? { id: userId, username: userName } : null;

  // Автоматическое подключение к звонку при наличии пользователя
  const startCall = async (roomId, roomName) => {
    console.log('useGlobalCall: startCall called with user:', user);
    if (!user) {
      console.error('User not authenticated');
      return false;
    }

    try {
      // Инициализируем звонок если еще не подключены
      if (!callContext.isConnected) {
        await callContext.initializeCall(user.id || user.userId, user.username || user.name);
      }

      // Присоединяемся к комнате
      await callContext.joinRoom(roomId);
      
      console.log(`Started call in room: ${roomName} (${roomId})`);
      return true;
    } catch (error) {
      console.error('Failed to start call:', error);
      callContext.setError(error.message);
      return false;
    }
  };

  // Завершение звонка
  const endCall = async () => {
    try {
      await callContext.endCall();
      console.log('Call ended');
    } catch (error) {
      console.error('Failed to end call:', error);
      callContext.setError(error.message);
    }
  };

  // Проверка, активен ли звонок
  const isCallActive = callContext.isInCall && callContext.isConnected;

  // Получение информации о текущем звонке
  const getCallInfo = () => {
    return {
      isActive: isCallActive,
      roomId: callContext.currentRoomId,
      participants: callContext.participants,
      isMuted: callContext.isMuted,
      isGlobalAudioMuted: callContext.isGlobalAudioMuted,
      error: callContext.error,
      audioBlocked: callContext.audioBlocked
    };
  };

  return {
    // Состояние
    ...callContext,
    isCallActive,
    
    // Методы
    startCall,
    endCall,
    getCallInfo,
    
    // Прямые методы из контекста
    toggleMute: callContext.toggleMute,
    toggleUserMute: callContext.toggleUserMute,
    changeUserVolume: callContext.changeUserVolume,
    toggleVolumeSlider: callContext.toggleVolumeSlider,
    toggleGlobalAudio: callContext.toggleGlobalAudio,
    toggleNoiseSuppression: callContext.toggleNoiseSuppression,
    changeNoiseSuppressionMode: callContext.changeNoiseSuppressionMode,
    setError: callContext.setError,
    clearError: callContext.clearError,
    setAudioBlocked: callContext.setAudioBlocked,
    startScreenShare: callContext.startScreenShare,
    stopScreenShare: callContext.stopScreenShare,
    toggleScreenShare: callContext.toggleScreenShare,
    startVideo: callContext.startVideo,
    stopVideo: callContext.stopVideo,
    toggleVideo: callContext.toggleVideo
  };
};
