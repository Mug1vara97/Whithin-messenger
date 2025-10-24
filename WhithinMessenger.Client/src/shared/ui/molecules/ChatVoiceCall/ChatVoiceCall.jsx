import React, { useEffect } from 'react';
import { useGlobalCall } from '../../../lib/hooks/useGlobalCall';
import { createParticipant } from '../../../../entities/video-call/model/types';
import MicIcon from '@mui/icons-material/Mic';
import MicOffIcon from '@mui/icons-material/MicOff';
import VideocamIcon from '@mui/icons-material/Videocam';
import VideocamOffIcon from '@mui/icons-material/VideocamOff';
import ScreenShareIcon from '@mui/icons-material/ScreenShare';
import StopScreenShareIcon from '@mui/icons-material/StopScreenShare';
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
    error,
    isGlobalAudioMuted,
    currentCall,
    isScreenSharing,
    startCall,
    endCall,
    toggleMute,
    toggleGlobalAudio,
    startScreenShare,
    stopScreenShare
  } = useGlobalCall(userId, userName);

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

  const handleScreenShare = async () => {
    try {
      if (isScreenSharing) {
        await stopScreenShare();
      } else {
        await startScreenShare();
      }
    } catch (error) {
      console.error('Screen share error:', error);
    }
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
          {isScreenSharing ? (
            /* При демонстрации экрана показываем фокус вместо кружков пользователей */
            <div className={styles.screenShareFocus}>
              <div className={styles.focusIndicator}>
                <ScreenShareIcon className={styles.focusIcon} />
                <span className={styles.focusText}>Демонстрация экрана</span>
              </div>
            </div>
          ) : (
            /* Обычное отображение кружков пользователей */
            displayParticipants.map((participant) => (
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
            ))
          )}
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

            {/* Демонстрация экрана */}
            <button 
              className={`${styles.controlBtn} ${styles.screenShareBtn} ${isScreenSharing ? 'active' : ''}`}
              onClick={handleScreenShare}
              title={isScreenSharing ? 'Остановить демонстрацию экрана' : 'Начать демонстрацию экрана'}
            >
              {isScreenSharing ? <StopScreenShareIcon /> : <ScreenShareIcon />}
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
