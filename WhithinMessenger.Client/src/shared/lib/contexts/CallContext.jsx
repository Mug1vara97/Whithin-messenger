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
  const screenShareAudioEnabled = useCallStore(state => state.screenShareAudioEnabled);
  const remoteScreenShares = useCallStore(state => state.remoteScreenShares);
  const isVideoEnabled = useCallStore(state => state.isVideoEnabled);
  const cameraStream = useCallStore(state => state.cameraStream);
  const devicesPreinitialized = useCallStore(state => state.devicesPreinitialized);
  const mediaDeviceInfo = useCallStore(state => state.mediaDeviceInfo);
  
  // Получаем отдельные состояния участников через селекторы для реактивности
  const participantMuteStates = useCallStore(state => state.participantMuteStates);
  const participantAudioStates = useCallStore(state => state.participantAudioStates);
  const participantGlobalAudioStates = useCallStore(state => state.participantGlobalAudioStates);
  const participantVideoStates = useCallStore(state => state.participantVideoStates);
  const participantSpeakingStates = useCallStore(state => state.participantSpeakingStates);
  const spatialAudioEnabled = useCallStore(state => state.spatialAudioEnabled);
  const showSpatialAudioStage = useCallStore(state => state.showSpatialAudioStage);
  const spatialPositionsVersion = useCallStore(state => state.spatialPositionsVersion);

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
  }, []);

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
  }, []);

  // Очистка при размонтировании провайдера
  useEffect(() => {
    // Прединициализация списка аудиоустройств при запуске приложения
    // без захвата микрофона (только проверка доступности/permissions).
    useCallStore.getState().preinitializeAudioDevices(false);

    const handleDeviceChange = () => {
      useCallStore.getState().preinitializeAudioDevices(false);
    };

    navigator?.mediaDevices?.addEventListener?.('devicechange', handleDeviceChange);

    return () => {
      navigator?.mediaDevices?.removeEventListener?.('devicechange', handleDeviceChange);
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
    screenShareAudioEnabled,
    remoteScreenShares,
    isVideoEnabled,
    cameraStream,
    devicesPreinitialized,
    mediaDeviceInfo,
    
    // Отдельные состояния участников для оптимизации рендеринга
    participantMuteStates,
    participantAudioStates,
    participantGlobalAudioStates,
    participantVideoStates,
    participantSpeakingStates,
    spatialAudioEnabled,
    showSpatialAudioStage,
    spatialPositionsVersion,
    
    // Методы (стабильные ссылки из zustand store)
    initializeCall: useCallStore.getState().initializeCall,
    joinRoom: useCallStore.getState().joinRoom,
    leaveRoom: useCallStore.getState().leaveRoom,
    endCall: useCallStore.getState().endCall,
    toggleMute: useCallStore.getState().toggleMute,
    toggleUserMute: useCallStore.getState().toggleUserMute,
    changeUserVolume: useCallStore.getState().changeUserVolume,
    toggleVolumeSlider: useCallStore.getState().toggleVolumeSlider,
    toggleGlobalAudio: useCallStore.getState().toggleGlobalAudio,
    toggleNoiseSuppression: useCallStore.getState().toggleNoiseSuppression,
    changeNoiseSuppressionMode: useCallStore.getState().changeNoiseSuppressionMode,
    setError: useCallStore.getState().setError,
    clearError: useCallStore.getState().clearError,
    setAudioBlocked: useCallStore.getState().setAudioBlocked,
    startScreenShare: useCallStore.getState().startScreenShare,
    stopScreenShare: useCallStore.getState().stopScreenShare,
    toggleScreenShare: useCallStore.getState().toggleScreenShare,
    changeScreenShareSource: useCallStore.getState().changeScreenShareSource,
    toggleScreenShareAudio: useCallStore.getState().toggleScreenShareAudio,
    startVideo: useCallStore.getState().startVideo,
    stopVideo: useCallStore.getState().stopVideo,
    toggleVideo: useCallStore.getState().toggleVideo,
    preinitializeAudioDevices: useCallStore.getState().preinitializeAudioDevices,
    toggleSpatialAudio: useCallStore.getState().toggleSpatialAudio,
    toggleSpatialAudioStage: useCallStore.getState().toggleSpatialAudioStage,
    setParticipantSpatialPosition: useCallStore.getState().setParticipantSpatialPosition,
    
    // Прямой доступ к store для расширенного использования
    store: useCallStore.getState()
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
    screenShareAudioEnabled,
    remoteScreenShares,
    isVideoEnabled,
    cameraStream,
    devicesPreinitialized,
    mediaDeviceInfo,
    participantMuteStates,
    participantAudioStates,
    participantGlobalAudioStates,
    participantVideoStates,
    participantSpeakingStates,
    spatialAudioEnabled,
    showSpatialAudioStage,
    spatialPositionsVersion,
  ]);

  return (
    <CallContext.Provider value={contextValue}>
      {children}
    </CallContext.Provider>
  );
};

export default CallContext;
