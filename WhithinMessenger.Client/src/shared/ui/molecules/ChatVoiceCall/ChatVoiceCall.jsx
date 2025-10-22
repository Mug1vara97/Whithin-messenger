import React, { useState, useEffect } from 'react';
import { useGlobalCall } from '../../../lib/hooks/useGlobalCall';
import { createParticipant } from '../../../../entities/video-call/model/types';
import MicIcon from '@mui/icons-material/Mic';
import MicOffIcon from '@mui/icons-material/MicOff';
import VideocamIcon from '@mui/icons-material/Videocam';
import VideocamOffIcon from '@mui/icons-material/VideocamOff';
import ScreenShareIcon from '@mui/icons-material/ScreenShare';
import CallEndIcon from '@mui/icons-material/CallEnd';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import VolumeOffIcon from '@mui/icons-material/VolumeOff';
import NoiseAwareIcon from '@mui/icons-material/NoiseAware';
import NoiseControlOffIcon from '@mui/icons-material/NoiseControlOff';
import styles from './ChatVoiceCall.module.css';

const ChatVoiceCall = ({
  chatId,
  chatName,
  userId,
  userName,
  onClose
}) => {
  const {
    isConnected,
    isMuted,
    isAudioEnabled,
    participants,
    audioBlocked,
    error,
    isNoiseSuppressed,
    noiseSuppressionMode,
    userVolumes,
    userMutedStates,
    showVolumeSliders,
    isGlobalAudioMuted,
    currentCall,
    startCall,
    endCall,
    toggleMute,
    toggleNoiseSuppression,
    changeNoiseSuppressionMode,
    toggleUserMute,
    changeUserVolume,
    toggleVolumeSlider,
    toggleGlobalAudio
  } = useGlobalCall(userId, userName);

  const [isExpanded, setIsExpanded] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Автоматически начинаем звонок при монтировании
  useEffect(() => {
    console.log('ChatVoiceCall: useEffect triggered with:', { chatId, userId, userName, chatName });

    if (chatId && userId && userName) {
      // Проверяем, не активен ли уже звонок в этом чате
      if (isConnected && currentCall?.channelId === chatId) {
        console.log('ChatVoiceCall: Call already active in this chat, skipping start');
        return;
      }

      console.log('ChatVoiceCall: Starting voice call');
      startCall(chatId, chatName).catch((err) => {
        console.error('Call start error:', err);
      });
    } else {
      console.log('ChatVoiceCall: Missing required parameters:', { chatId, userId, userName });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId, chatName, userId, userName]);

  // Очистка при размонтировании
  useEffect(() => {
    return () => {
      console.log('ChatVoiceCall: Component unmounted, but call continues in background');
    };
  }, []);

  const handleClose = () => {
    if (onClose) {
      onClose();
    }
  };

  const handleDisconnect = async () => {
    await endCall();
    handleClose();
  };

  const handleToggleMute = () => {
    toggleMute();
  };

  const handleToggleVideo = () => {
    // Видео не поддерживается в голосовых звонках
    console.log('Video not supported in voice calls');
  };

  const handleScreenShare = () => {
    // Пока не реализовано
    console.log('Screen share not implemented');
  };

  const handleToggleNoiseSuppression = () => {
    toggleNoiseSuppression();
  };

  const handleEndCall = async () => {
    handleDisconnect();
  };

  // Создаем участников для отображения, как в VoiceCallView.jsx
  const currentUser = createParticipant(userId, userName || 'You', null, 'online', 'host');
  currentUser.isMuted = isMuted;
  currentUser.isAudioEnabled = isAudioEnabled;
  currentUser.isGlobalAudioMuted = isGlobalAudioMuted; // Используем из глобального состояния
  currentUser.isSpeaking = false;
  
  const displayParticipants = [currentUser];
  
  // Добавляем всех остальных участников из глобального состояния
  participants.forEach(participant => {
    const videoParticipant = createParticipant(
      participant.userId || participant.id || participant.name, 
      participant.name, 
      participant.avatar || null, 
      'online', 
      'participant'
    );
    videoParticipant.isMuted = participant.isMuted || false;
    videoParticipant.isGlobalAudioMuted = participant.isGlobalAudioMuted || false;
    videoParticipant.isSpeaking = participant.isSpeaking || false;
    displayParticipants.push(videoParticipant);
  });

  if (!isConnected) {
    return null;
  }

  return (
    <div className={styles.voiceCallContainer}>
      {/* Основная область участников */}
      <div className={styles.voiceCallWrapper}>
        <div className={styles.participantsContainer}>
          {displayParticipants.map((participant, index) => (
            <div key={participant.id} className={styles.participantItem}>
              <div className={styles.participantAvatarContainer}>
                <div className={styles.participantAvatar}>
                  <div className={styles.avatarCircle}>
                    {(participant.name || 'U').charAt(0).toUpperCase()}
                  </div>
                  {/* Индикаторы статуса */}
                  <div className={styles.statusIndicators}>
                    {participant.isMuted && (
                      <div className={`${styles.statusIndicator} ${styles.muteIndicator}`}>
                        <MicOffIcon />
                      </div>
                    )}
                    {participant.isGlobalAudioMuted && (
                      <div className={`${styles.statusIndicator} ${styles.audioMutedIndicator}`}>
                        <VolumeOffIcon />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>


      {/* Нижняя панель управления */}
      <div className={styles.bottomControls}>
        <div className={styles.controlSection}>
          <div className={styles.mainControls}>
            {/* Микрофон */}
            <button 
              className={`${styles.controlBtn} ${styles.microphoneBtn} ${isMuted ? 'muted' : 'unmuted'}`}
              onClick={handleToggleMute}
              title={isMuted ? 'Включить микрофон' : 'Выключить микрофон'}
            >
              {isMuted ? <MicOffIcon /> : <MicIcon />}
            </button>

            {/* Камера */}
            <button 
              className={`${styles.controlBtn} ${styles.cameraBtn} disabled`}
              onClick={handleToggleVideo}
              title="Камера недоступна"
              disabled
            >
              <VideocamOffIcon />
            </button>

            {/* Глобальный звук */}
            <button 
              className={`${styles.controlBtn} ${styles.globalAudioBtn} ${isGlobalAudioMuted ? 'muted' : 'unmuted'}`}
              onClick={toggleGlobalAudio}
              title={isGlobalAudioMuted ? 'Включить звук' : 'Выключить звук'}
            >
              {isGlobalAudioMuted ? <VolumeOffIcon /> : <VolumeUpIcon />}
            </button>

            {/* Завершить звонок */}
            <button 
              className={`${styles.controlBtn} ${styles.endCallBtn}`}
              onClick={handleEndCall}
              title="Завершить звонок"
            >
              <CallEndIcon />
            </button>
          </div>
        </div>
      </div>

      {/* Ошибки */}
      {error && (
        <div className={styles.errorBanner}>
          <span>Ошибка: {error}</span>
        </div>
      )}
    </div>
  );
};

export default ChatVoiceCall;
