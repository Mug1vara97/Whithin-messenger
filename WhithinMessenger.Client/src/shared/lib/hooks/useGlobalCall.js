import { useCall } from '../contexts/CallContext';
import { useAuth } from './useAuth';

/**
 * Хук для работы с глобальным состоянием звонков
 * Использует CallContext для доступа к глобальному состоянию звонков
 */
export const useGlobalCall = (userId = null, userName = null) => {
  const callContext = useCall();
  const { user: authUser } = useAuth();
  
  // Используем переданного пользователя или пользователя из auth
  const user = userId && userName ? { id: userId, username: userName } : authUser;

  // Автоматическое подключение к звонку при наличии пользователя
  const startCall = async (roomId, roomName) => {
    console.log('useGlobalCall: startCall called with user:', user);
    if (!user) {
      console.error('User not authenticated');
      return false;
    }

    try {
      // Проверяем, есть ли активный звонок в другом канале
      if (callContext.isConnected && callContext.currentRoomId && callContext.currentRoomId !== roomId) {
        console.log(`useGlobalCall: Active call in different channel (${callContext.currentRoomId}), ending it first before joining ${roomId}`);
        // Сначала отключаемся от текущего канала
        const previousRoomId = callContext.currentRoomId;
        await callContext.endCall();
        
        // Ждем, пока соединение полностью закроется (максимум 3 секунды)
        let waitCount = 0;
        const maxWait = 30; // 30 * 100ms = 3 секунды
        while (callContext.isConnected && waitCount < maxWait) {
          await new Promise(resolve => setTimeout(resolve, 100));
          waitCount++;
        }
        
        if (callContext.isConnected) {
          console.warn('useGlobalCall: Connection still active after endCall, waiting additional time');
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        console.log(`useGlobalCall: Disconnected from previous room (${previousRoomId}), ready to join new room (${roomId})`);
      }

      // Инициализируем звонок если еще не подключены
      if (!callContext.isConnected) {
        console.log('useGlobalCall: Initializing call connection');
        await callContext.initializeCall(user.id || user.userId, user.username || user.name);
        // Не проверяем isConnected здесь - initializeCall сам установит соединение
        // Если соединение не установилось, joinRoom выдаст ошибку
      }

      // Присоединяемся к комнате
      // joinRoom сам проверит, что соединение установлено
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
