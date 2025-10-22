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

  // Создаем участников для отображения
  const displayParticipants = participants.map(participant => 
    createParticipant({
      id: participant.userId,
      name: participant.name,
      isMuted: participant.isMuted,
      isSpeaking: participant.isSpeaking,
      isVideoEnabled: false, // Голосовые звонки без видео
      volume: userVolumes.get(participant.userId) || 100
    })
  );

  if (!isConnected) {
    return null;
  }

  return (
    <div className="chat-voice-call">
      {/* Заголовок звонка */}
      <div className="call-header">
        <div className="call-info">
          <div className="call-title">
            <span className="call-icon">📞</span>
            <span className="call-name">{chatName}</span>
          </div>
          <div className="call-status">
            {participants.length} участник{participants.length !== 1 ? 'ов' : ''}
          </div>
        </div>
        <div className="call-controls-header">
          <button 
            className="control-btn settings-btn"
            onClick={() => setShowSettings(!showSettings)}
            title="Настройки"
          >
            ⚙️
          </button>
          <button 
            className="control-btn minimize-btn"
            onClick={() => setIsExpanded(!isExpanded)}
            title={isExpanded ? "Свернуть" : "Развернуть"}
          >
            {isExpanded ? "−" : "+"}
          </button>
        </div>
      </div>

      {/* Основной контент */}
      {isExpanded && (
        <div className="call-content">
          {/* Участники */}
          <div className="participants-grid">
            {displayParticipants.map((participant, index) => (
              <div key={participant.id} className="participant-item">
                <div className="participant-avatar">
                  <div className="avatar-circle">
                    {participant.name.charAt(0).toUpperCase()}
                  </div>
                  {participant.isMuted && (
                    <div className="mute-indicator">
                      <MicOffIcon />
                    </div>
                  )}
                </div>
                <div className="participant-info">
                  <div className="participant-name">{participant.name}</div>
                  <div className="participant-status">
                    {participant.isMuted ? 'Заглушен' : 'Говорит'}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Панель управления */}
          <div className="call-controls">
            <div className="control-group">
              <button 
                className={`control-btn ${isMuted ? 'muted' : 'unmuted'}`}
                onClick={handleToggleMute}
                title={isMuted ? 'Включить микрофон' : 'Выключить микрофон'}
              >
                {isMuted ? <MicOffIcon /> : <MicIcon />}
              </button>
              
              <button 
                className="control-btn video-btn disabled"
                onClick={handleToggleVideo}
                title="Камера недоступна"
                disabled
              >
                <VideocamIcon />
              </button>
              
              <button 
                className="control-btn screen-btn"
                onClick={handleScreenShare}
                title="Поделиться экраном"
              >
                <ScreenShareIcon />
              </button>
            </div>

            <div className="control-group">
              <button 
                className={`control-btn ${isNoiseSuppressed ? 'active' : ''}`}
                onClick={handleToggleNoiseSuppression}
                title={isNoiseSuppressed ? 'Отключить шумоподавление' : 'Включить шумоподавление'}
              >
                {isNoiseSuppressed ? <NoiseAwareIcon /> : <NoiseControlOffIcon />}
              </button>
              
              <button 
                className={`control-btn ${isGlobalAudioMuted ? 'muted' : 'unmuted'}`}
                onClick={toggleGlobalAudio}
                title={isGlobalAudioMuted ? 'Включить звук' : 'Выключить звук'}
              >
                {isGlobalAudioMuted ? <VolumeOffIcon /> : <VolumeUpIcon />}
              </button>
            </div>

            <button 
              className="control-btn end-call-btn"
              onClick={handleEndCall}
              title="Завершить звонок"
            >
              <CallEndIcon />
            </button>
          </div>

          {/* Настройки */}
          {showSettings && (
            <div className="call-settings">
              <div className="settings-section">
                <h4>Шумоподавление</h4>
                <div className="noise-controls">
                  <button 
                    className={`noise-btn ${noiseSuppressionMode === 'rnnoise' ? 'active' : ''}`}
                    onClick={() => changeNoiseSuppressionMode('rnnoise')}
                  >
                    RNNoise
                  </button>
                  <button 
                    className={`noise-btn ${noiseSuppressionMode === 'speex' ? 'active' : ''}`}
                    onClick={() => changeNoiseSuppressionMode('speex')}
                  >
                    Speex
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

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
