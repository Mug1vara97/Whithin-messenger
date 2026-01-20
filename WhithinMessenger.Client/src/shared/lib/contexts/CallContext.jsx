import React, { createContext, useContext, useEffect, useRef } from 'react';
import { useCallStore } from '../stores/callStore';

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
  
  // Получаем реактивные значения из Zustand store через селекторы
  // Это критично для правильной подписки на изменения!
  const isConnected = useCallStore(state => state.isConnected);
  const isInCall = useCallStore(state => state.isInCall);
  const currentRoomId = useCallStore(state => state.currentRoomId);
  const currentUserId = useCallStore(state => state.currentUserId);
  const currentUserName = useCallStore(state => state.currentUserName);
  const currentCall = useCallStore(state => state.currentCall);
  const participants = useCallStore(state => state.participants);
  const isMuted = useCallStore(state => state.isMuted);
  const isGlobalAudioMuted = useCallStore(state => state.isGlobalAudioMuted);
  const isAudioEnabled = useCallStore(state => state.isAudioEnabled);
  const isNoiseSuppressed = useCallStore(state => state.isNoiseSuppressed);
  const noiseSuppressionMode = useCallStore(state => state.noiseSuppressionMode);
  const userVolumes = useCallStore(state => state.userVolumes);
  const userMutedStates = useCallStore(state => state.userMutedStates);
  const showVolumeSliders = useCallStore(state => state.showVolumeSliders);
  const error = useCallStore(state => state.error);
  const audioBlocked = useCallStore(state => state.audioBlocked);
  const connecting = useCallStore(state => state.connecting);
  const isScreenSharing = useCallStore(state => state.isScreenSharing);
  const screenShareStream = useCallStore(state => state.screenShareStream);
  const remoteScreenShares = useCallStore(state => state.remoteScreenShares);
  const isVideoEnabled = useCallStore(state => state.isVideoEnabled);
  const cameraStream = useCallStore(state => state.cameraStream);
  
  // Получаем отдельные состояния участников через селекторы для реактивности
  const participantMuteStates = useCallStore(state => state.participantMuteStates);
  const participantAudioStates = useCallStore(state => state.participantAudioStates);
  const participantGlobalAudioStates = useCallStore(state => state.participantGlobalAudioStates);
  const participantVideoStates = useCallStore(state => state.participantVideoStates);
  const participantSpeakingStates = useCallStore(state => state.participantSpeakingStates);

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

  const contextValue = React.useMemo(() => ({
    // Состояние (используем реактивные переменные из селекторов)
    isConnected,
    isInCall,
    currentRoomId,
    currentUserId,
    currentUserName,
    currentCall,
    participants,
    isMuted,
    isGlobalAudioMuted,
    isAudioEnabled,
    isNoiseSuppressed,
    noiseSuppressionMode,
    userVolumes,
    userMutedStates,
    showVolumeSliders,
    error,
    audioBlocked,
    connecting,
    isScreenSharing,
    screenShareStream,
    remoteScreenShares,
    isVideoEnabled,
    cameraStream,
    
    // Отдельные состояния участников для оптимизации рендеринга
    participantMuteStates,
    participantAudioStates,
    participantGlobalAudioStates,
    participantVideoStates,
    participantSpeakingStates,
    
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
  }), [
    isConnected,
    isInCall,
    currentRoomId,
    currentUserId,
    currentUserName,
    currentCall,
    participants,
    isMuted,
    isGlobalAudioMuted,
    isAudioEnabled,
    isNoiseSuppressed,
    noiseSuppressionMode,
    userVolumes,
    userMutedStates,
    showVolumeSliders,
    error,
    audioBlocked,
    connecting,
    isScreenSharing,
    screenShareStream,
    remoteScreenShares,
    isVideoEnabled,
    cameraStream,
    participantMuteStates,
    participantAudioStates,
    participantGlobalAudioStates,
    participantVideoStates,
    participantSpeakingStates,
    callStore
  ]);

  return (
    <CallContext.Provider value={contextValue}>
      {children}
    </CallContext.Provider>
  );
};

export default CallContext;
