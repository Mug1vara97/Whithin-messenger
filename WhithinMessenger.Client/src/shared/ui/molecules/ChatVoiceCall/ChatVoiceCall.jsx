import React, { useState, useEffect } from 'react';
import { useGlobalCall } from '../../../lib/hooks/useGlobalCall';
import { createParticipant } from '../../../../entities/video-call/model/types';
import MicIcon from '@mui/icons-material/Mic';
import MicOffIcon from '@mui/icons-material/MicOff';
import VideocamIcon from '@mui/icons-material/Videocam';
import ScreenShareIcon from '@mui/icons-material/ScreenShare';
import CallEndIcon from '@mui/icons-material/CallEnd';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import VolumeOffIcon from '@mui/icons-material/VolumeOff';
import NoiseAwareIcon from '@mui/icons-material/NoiseAware';
import NoiseControlOffIcon from '@mui/icons-material/NoiseControlOff';
import './ChatVoiceCall.css';

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

  // Создаем участников для отображения, включая текущего пользователя
  const currentUser = createParticipant(
    userId,
    userName || 'You',
    null, // avatar
    'online', // status
    'participant' // role
  );

  const otherParticipants = participants.map(participant => 
    createParticipant(
      participant.userId || participant.id,
      participant.name || 'Unknown',
      null, // avatar
      'online', // status
      'participant' // role
    )
  );

  // Объединяем текущего пользователя с другими участниками
  const displayParticipants = [currentUser, ...otherParticipants];

  if (!isConnected) {
    return null;
  }

  return (
    <div className="voice-call-container">
      {/* Основная область участников */}
      <div className="voice-call-wrapper">
        <div className="participants-container">
          {displayParticipants.map((participant, index) => (
            <div key={participant.id} className="participant-item">
              <div className="participant-avatar-container">
                <div className="participant-avatar">
                  <div className="avatar-circle">
                    {(participant.name || 'U').charAt(0).toUpperCase()}
                  </div>
                  {participant.isMuted && (
                    <div className="mute-indicator">
                      <MicOffIcon />
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>


      {/* Нижняя панель управления */}
      <div className="bottom-controls">
        <div className="control-section">
          <div className="main-controls">
            {/* Микрофон */}
            <div className="control-group">
              <button 
                className={`control-btn microphone-btn ${isMuted ? 'muted' : 'unmuted'}`}
                onClick={handleToggleMute}
                title={isMuted ? 'Включить микрофон' : 'Выключить микрофон'}
              >
                {isMuted ? <MicOffIcon /> : <MicIcon />}
              </button>
              <div className="control-dropdown">▼</div>
            </div>

            {/* Камера */}
            <div className="control-group">
              <button 
                className="control-btn camera-btn disabled"
                onClick={handleToggleVideo}
                title="Камера недоступна"
                disabled
              >
                <VideocamIcon />
              </button>
              <div className="control-dropdown">▼</div>
            </div>

            {/* Демонстрация экрана */}
            <div className="control-group">
              <button 
                className="control-btn screen-share-btn"
                onClick={handleScreenShare}
                title="Поделиться экраном"
              >
                <ScreenShareIcon />
              </button>
            </div>

            {/* Активности */}
            <div className="control-group">
              <button 
                className="control-btn activity-btn"
                title="Начать активность"
              >
                🎮
              </button>
            </div>

            {/* Настройки */}
            <div className="control-group">
              <button 
                className="control-btn settings-btn"
                title="Другие настройки"
              >
                ⋯
              </button>
            </div>

            {/* Завершить звонок */}
            <button 
              className="control-btn end-call-btn"
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
        <div className="error-banner">
          <span>Ошибка: {error}</span>
        </div>
      )}
    </div>
  );
};

export default ChatVoiceCall;
