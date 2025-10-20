import React, { useState, useEffect } from 'react';
import { useVoiceCall } from '../../../entities/voice-call/hooks';
import './VoiceCallView.css';

const VoiceCallView = ({
  channelId,
  channelName,
  userId,
  userName,
  onClose
}) => {
  const {
    isConnected,
    isMuted,
    isAudioEnabled,
    participants,
    volume,
    audioBlocked,
    error,
    connect,
    disconnect,
    joinRoom,
    toggleMute,
    toggleAudio,
    handleVolumeChange
  } = useVoiceCall(userId, userName);

  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const [isConnecting, setIsConnecting] = useState(true);

  // Автоматическое подключение при монтировании
  useEffect(() => {
    if (channelId && userId && userName) {
      setIsConnecting(true);
      connect().then(() => {
        joinRoom(channelId);
        setTimeout(() => setIsConnecting(false), 1000);
      }).catch(() => {
        setIsConnecting(false);
      });
    }
  }, [channelId, userId, userName, connect, joinRoom]);

  // Очистка при размонтировании
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  // Закрытие слайдера громкости при клике вне его
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (showVolumeSlider && !e.target.closest('.volume-control')) {
        setShowVolumeSlider(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showVolumeSlider]);

  const handleClose = () => {
    disconnect();
    if (onClose) {
      onClose();
    }
  };

  const enableAudioPlayback = async () => {
    const audioElements = document.querySelectorAll('audio');
    for (const audio of audioElements) {
      try {
        await audio.play();
      } catch (e) {
        console.log('Failed to play audio:', e);
      }
    }
  };

  // Получаем инициалы для аватара
  const getInitials = (name) => {
    if (!name) return '?';
    const words = name.trim().split(' ');
    if (words.length === 1) {
      return name.charAt(0).toUpperCase();
    }
    return (words[0].charAt(0) + words[words.length - 1].charAt(0)).toUpperCase();
  };

  // Генерация цвета аватара на основе имени
  const getAvatarColor = (name) => {
    const colors = [
      '#5865f2', '#3ba55d', '#faa81a', '#ed4245', '#eb459e',
      '#57f287', '#fee75c', '#f26522', '#00d9ff', '#7289da'
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  return (
    <div className="voice-call-view">
      {/* Header */}
      <div className="voice-call-header">
        <div className="voice-call-header-left">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 3C10.34 3 9 4.34 9 6C9 7.66 10.34 9 12 9C13.66 9 15 7.66 15 6C15 4.34 13.66 3 12 3ZM12 11C9.34 11 4 12.34 4 15V16C4 16.55 4.45 17 5 17H19C19.55 17 20 16.55 20 16V15C20 12.34 14.66 11 12 11Z"/>
            <path d="M12 3C10.34 3 9 4.34 9 6C9 7.66 10.34 9 12 9C13.66 9 15 7.66 15 6C15 4.34 13.66 3 12 3Z" opacity="0.6"/>
            <circle cx="18" cy="8" r="3" fill="#23a55a"/>
            <circle cx="6" cy="8" r="3" fill="#23a55a" opacity="0.7"/>
          </svg>
          <span className="voice-call-title">{channelName}</span>
        </div>
        <button className="voice-call-close-btn" onClick={handleClose} title="Отключиться">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18.4 4L12 10.4L5.6 4L4 5.6L10.4 12L4 18.4L5.6 20L12 13.6L18.4 20L20 18.4L13.6 12L20 5.6L18.4 4Z"/>
          </svg>
        </button>
      </div>

      {/* Main Content */}
      <div className={`voice-call-content ${isConnecting ? 'loading' : ''}`}>
        {!isConnecting && (
          <>
            {audioBlocked && (
              <div className="audio-blocked-banner">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                </svg>
                <div className="audio-blocked-text">
                  <strong>Браузер заблокировал автовоспроизведение</strong>
                  <span>Нажмите кнопку ниже, чтобы разрешить воспроизведение звука</span>
                  <button className="enable-audio-btn" onClick={enableAudioPlayback}>
                    Разрешить воспроизведение
                  </button>
                </div>
              </div>
            )}

            {error && (
              <div className="voice-call-error">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                </svg>
                <span>{error}</span>
              </div>
            )}

            {/* Participants Grid */}
            {(participants.length > 0 || isConnected) && (
              <div className="participants-grid">
                {/* Current User */}
                <div className="participant-tile current-user">
                  <div 
                    className="participant-avatar" 
                    style={{ background: getAvatarColor(userName) }}
                  >
                    {getInitials(userName)}
                  </div>
                  <div className="participant-info">
                    <span className="participant-name">{userName}</span>
                  </div>
                </div>

                {/* Other Participants */}
                {participants.map((participant, index) => (
                  <div key={index} className="participant-tile">
                    <div 
                      className="participant-avatar"
                      style={{ background: getAvatarColor(participant.name) }}
                    >
                      {getInitials(participant.name)}
                    </div>
                    <div className="participant-info">
                      <span className="participant-name">{participant.name}</span>
                      {participant.isSpeaking && (
                        <div className="speaking-indicator">
                          <div className="speaking-ring"></div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Empty State */}
            {participants.length === 0 && !isConnecting && isConnected && (
              <div className="voice-call-empty">
                <div className="empty-icon">
                  <svg width="184" height="128" viewBox="0 0 184 128" fill="none">
                    <g opacity="0.3">
                      <path d="M92 24C78.7452 24 68 34.7452 68 48V72C68 85.2548 78.7452 96 92 96C105.255 96 116 85.2548 116 72V48C116 34.7452 105.255 24 92 24Z" fill="currentColor"/>
                      <path d="M60 64V72C60 89.6731 74.3269 104 92 104C109.673 104 124 89.6731 124 72V64H132V72C132 94.0914 114.091 112 92 112C69.9086 112 52 94.0914 52 72V64H60Z" fill="currentColor"/>
                      <rect x="88" y="112" width="8" height="16" fill="currentColor"/>
                      <rect x="72" y="120" width="40" height="8" rx="4" fill="currentColor"/>
                    </g>
                  </svg>
                </div>
                <p className="empty-message">Сейчас здесь никого нет. Пригласите кого-нибудь, чтобы поболтать!</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Voice Controls */}
      <div className="voice-controls">
        <div className="voice-controls-wrapper">
          {/* Microphone */}
          <button 
            className={`voice-control-btn ${isMuted ? 'muted' : ''}`}
            onClick={toggleMute}
            title={isMuted ? 'Включить микрофон' : 'Выключить микрофон'}
          >
            {isMuted ? (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6.7 11H5C5 12.19 5.34 13.3 5.9 14.28L7.13 13.05C6.86 12.43 6.7 11.74 6.7 11Z"/>
                <path d="M9.01 11.085C9.01 11.035 9.01 11.015 9.01 11C9.01 8.99 10.71 7.39 12.71 7.39C14.71 7.39 16.41 8.99 16.41 11C16.41 11.015 16.41 11.035 16.41 11.085L9.01 11.085Z"/>
                <path d="M11.7999 19.3101C13.7599 19.3101 15.3699 17.6201 15.6099 15.5401L11.7999 19.3101Z"/>
                <path d="M21 4.27L19.73 3L3 19.73L4.27 21L8.46 16.81C9.69 17.84 11.23 18.5 12.95 18.5C16.95 18.5 20.2 15.25 20.2 11.25H18.7C18.7 14.47 16.17 17 12.95 17C11.13 17 9.47 16.28 8.21 15.13L21 4.27Z"/>
              </svg>
            ) : (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C10.34 2 9 3.34 9 5V11C9 12.66 10.34 14 12 14C13.66 14 15 12.66 15 11V5C15 3.34 13.66 2 12 2Z"/>
                <path d="M19 11C19 14.53 16.39 17.44 13 17.93V21H11V17.93C7.61 17.44 5 14.53 5 11H7C7 13.76 9.24 16 12 16C14.76 16 17 13.76 17 11H19Z"/>
              </svg>
            )}
          </button>

          {/* Speaker */}
          <button 
            className={`voice-control-btn ${!isAudioEnabled ? 'muted' : ''}`}
            onClick={toggleAudio}
            title={isAudioEnabled ? 'Отключить звук' : 'Включить звук'}
          >
            {!isAudioEnabled ? (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6.7 11H5C5 12.19 5.34 13.3 5.9 14.28L7.13 13.05C6.86 12.43 6.7 11.74 6.7 11Z"/>
                <path d="M21 4.27L19.73 3L3 19.73L4.27 21L21 4.27Z"/>
                <path d="M11.383 3.07904C11.009 2.92504 10.579 3.01004 10.293 3.29604L6 8.00004H3C2.45 8.00004 2 8.45004 2 9.00004V15C2 15.55 2.45 16 3 16H6L10.293 20.71C10.579 20.996 11.009 21.082 11.383 20.927C11.757 20.772 12 20.407 12 20V4.00004C12 3.59304 11.757 3.22804 11.383 3.07904Z" opacity="0.3"/>
              </svg>
            ) : (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M11.383 3.07904C11.009 2.92504 10.579 3.01004 10.293 3.29604L6 8.00004H3C2.45 8.00004 2 8.45004 2 9.00004V15C2 15.55 2.45 16 3 16H6L10.293 20.71C10.579 20.996 11.009 21.082 11.383 20.927C11.757 20.772 12 20.407 12 20V4.00004C12 3.59304 11.757 3.22804 11.383 3.07904ZM14 5.00004V7.00004C16.757 7.00004 19 9.24304 19 12C19 14.757 16.757 17 14 17V19C17.86 19 21 15.86 21 12C21 8.14004 17.86 5.00004 14 5.00004Z"/>
              </svg>
            )}
          </button>

          {/* Volume */}
          <div className="volume-control">
            <button 
              className="voice-control-btn"
              onClick={() => setShowVolumeSlider(!showVolumeSlider)}
              title="Настройки громкости"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/>
              </svg>
            </button>
            {showVolumeSlider && (
              <div className="volume-slider-container">
                <span className="volume-value">{Math.round(volume * 100)}%</span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={volume}
                  onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                  className="volume-slider"
                />
              </div>
            )}
          </div>

          {/* Disconnect */}
          <button 
            className="voice-control-btn disconnect-btn"
            onClick={handleClose}
            title="Отключиться от канала"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08c-.18-.17-.29-.42-.29-.7 0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28-.79-.74-1.69-1.36-2.67-1.85-.33-.16-.56-.5-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default VoiceCallView;
