import React, { createContext, useContext, useEffect, useRef } from 'react';
import { useCallStore } from '../stores/callStore';
import { shallow } from 'zustand/shallow';

const CallContext = createContext();

export const useCall = () => {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error('useCall must be used within a CallProvider');
  }
  return context;
};

export const CallProvider = ({ children }) => {
  const callStore = useCallStore();
  const isInitialized = useRef(false);
  
  // Получаем реактивные значения из Zustand store
  const isScreenSharing = useCallStore(state => state.isScreenSharing);
  const screenShareStream = useCallStore(state => state.screenShareStream);
  const remoteScreenShares = useCallStore(state => state.remoteScreenShares);
  
  // Подписываемся на изменения userVolumes, userMutedStates, showVolumeSliders
  // Используем shallow для правильного сравнения Map объектов
  const { userVolumes, userMutedStates, showVolumeSliders } = useCallStore(
    state => ({
      userVolumes: state.userVolumes,
      userMutedStates: state.userMutedStates,
      showVolumeSliders: state.showVolumeSliders
    }),
    shallow
  );
  
  // Логируем изменения для отладки
  useEffect(() => {
    console.log('🔄 CallContext: userVolumes updated', {
      size: userVolumes?.size,
      entries: Array.from(userVolumes?.entries() || [])
    });
  }, [userVolumes]);
  
  useEffect(() => {
    console.log('🔄 CallContext: userMutedStates updated', {
      size: userMutedStates?.size,
      entries: Array.from(userMutedStates?.entries() || [])
    });
  }, [userMutedStates]);
  
  useEffect(() => {
    console.log('🔄 CallContext: showVolumeSliders updated', {
      size: showVolumeSliders?.size,
      entries: Array.from(showVolumeSliders?.entries() || [])
    });
  }, [showVolumeSliders]);

  // Инициализация шумоподавления из localStorage
  useEffect(() => {
    if (!isInitialized.current) {
      const savedNoiseSuppression = localStorage.getItem('noiseSuppression');
      if (savedNoiseSuppression) {
        try {
          const isNoiseSuppressed = JSON.parse(savedNoiseSuppression);
          if (isNoiseSuppressed) {
            // Устанавливаем состояние, но не включаем шумоподавление до создания потока
            // Устанавливаем состояние через прямое обновление store
            useCallStore.setState({ isNoiseSuppressed: true });
          }
        } catch (error) {
          console.warn('Failed to parse noise suppression setting:', error);
        }
      }
      isInitialized.current = true;
    }
  }, [callStore]);

  // Обработчик изменения настроек шумоподавления из других компонентов
  useEffect(() => {
    const handleNoiseSuppressionChanged = (event) => {
      const { enabled } = event.detail;
      useCallStore.setState({ isNoiseSuppressed: enabled });
      
      // Если шумоподавление включено и у нас есть поток, включаем его
      const state = useCallStore.getState();
      if (enabled && state.noiseSuppressionManager) {
        state.noiseSuppressionManager.enable(state.noiseSuppressionMode);
      } else if (!enabled && state.noiseSuppressionManager) {
        state.noiseSuppressionManager.disable();
      }
    };

    window.addEventListener('noiseSuppressionChanged', handleNoiseSuppressionChanged);
    return () => {
      window.removeEventListener('noiseSuppressionChanged', handleNoiseSuppressionChanged);
    };
  }, [callStore]);

  // Очистка при размонтировании провайдера
  useEffect(() => {
    return () => {
      // Не очищаем соединение здесь, так как оно должно жить глобально
      // Очистка происходит только при явном завершении звонка
    };
  }, []);

  const contextValue = {
    // Состояние
    isConnected: callStore.isConnected,
    isInCall: callStore.isInCall,
    currentRoomId: callStore.currentRoomId,
    currentUserId: callStore.currentUserId,
    currentUserName: callStore.currentUserName,
    currentCall: callStore.currentCall,
    participants: callStore.participants,
    isMuted: callStore.isMuted,
    isGlobalAudioMuted: callStore.isGlobalAudioMuted,
    isNoiseSuppressed: callStore.isNoiseSuppressed,
    noiseSuppressionMode: callStore.noiseSuppressionMode,
    userVolumes: userVolumes,  // Используем реактивные значения из хука
    userMutedStates: userMutedStates,  // Используем реактивные значения из хука
    showVolumeSliders: showVolumeSliders,  // Используем реактивные значения из хука
    error: callStore.error,
    audioBlocked: callStore.audioBlocked,
    connecting: callStore.connecting,
    isScreenSharing: isScreenSharing,
    screenShareStream: screenShareStream,
    remoteScreenShares: remoteScreenShares,
    isVideoEnabled: callStore.isVideoEnabled,
    cameraStream: callStore.cameraStream,
    
    // Методы
    initializeCall: callStore.initializeCall,
    joinRoom: callStore.joinRoom,
    endCall: callStore.endCall,
    toggleMute: callStore.toggleMute,
    toggleUserMute: callStore.toggleUserMute,
    changeUserVolume: callStore.changeUserVolume,
    toggleVolumeSlider: callStore.toggleVolumeSlider,
    toggleGlobalAudio: callStore.toggleGlobalAudio,
    toggleNoiseSuppression: callStore.toggleNoiseSuppression,
    changeNoiseSuppressionMode: callStore.changeNoiseSuppressionMode,
    setError: callStore.setError,
    clearError: callStore.clearError,
    setAudioBlocked: callStore.setAudioBlocked,
    startScreenShare: callStore.startScreenShare,
    stopScreenShare: callStore.stopScreenShare,
    toggleScreenShare: callStore.toggleScreenShare,
    startVideo: callStore.startVideo,
    stopVideo: callStore.stopVideo,
    toggleVideo: callStore.toggleVideo,
    
    // Прямой доступ к store для расширенного использования
    store: callStore
  };

  return (
    <CallContext.Provider value={contextValue}>
      {children}
    </CallContext.Provider>
  );
};

export default CallContext;
