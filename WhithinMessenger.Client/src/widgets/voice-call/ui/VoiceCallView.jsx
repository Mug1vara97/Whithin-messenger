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

  // Автоматическое подключение при монтировании
  useEffect(() => {
    if (channelId && userId && userName) {
      connect().then(() => {
        joinRoom(channelId);
      });
    }
  }, [channelId, userId, userName, connect, joinRoom]);

  // Очистка при размонтировании
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

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

  return (
    <div className="voice-call-view">
      {/* Header */}
      <div className="voice-call-header">
        <div className="voice-call-header-left">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M11.383 3.07904C11.009 2.92504 10.579 3.01004 10.293 3.29604L6 8.00004H3C2.45 8.00004 2 8.45004 2 9.00004V15C2 15.55 2.45 16 3 16H6L10.293 20.71C10.579 20.996 11.009 21.082 11.383 20.927C11.757 20.772 12 20.407 12 20V4.00004C12 3.59304 11.757 3.22804 11.383 3.07904ZM14 5.00004V7.00004C16.757 7.00004 19 9.24304 19 12C19 14.757 16.757 17 14 17V19C17.86 19 21 15.86 21 12C21 8.14004 17.86 5.00004 14 5.00004ZM14 9.00004V15C15.654 15 17 13.654 17 12C17 10.346 15.654 9.00004 14 9.00004Z" />
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
      <div className="voice-call-content">
        {audioBlocked && (
          <div className="audio-blocked-banner">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
            </svg>
            <div className="audio-blocked-text">
              <strong>Браузер заблокировал автовоспроизведение аудио</strong>
              <button className="enable-audio-btn" onClick={enableAudioPlayback}>
                Разрешить воспроизведение
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="voice-call-error">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
            </svg>
            <span>{error}</span>
          </div>
        )}

        {/* Participants Grid */}
        <div className="participants-grid">
          {participants.map((participant, index) => (
            <div key={index} className="participant-tile">
              <div className="participant-avatar">
                {participant.name.charAt(0).toUpperCase()}
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

          {/* Current User */}
          <div className="participant-tile current-user">
            <div className="participant-avatar">
              {userName.charAt(0).toUpperCase()}
            </div>
            <div className="participant-info">
              <span className="participant-name">{userName} (Вы)</span>
            </div>
          </div>
        </div>

        {/* Empty State */}
        {participants.length === 0 && (
          <div className="voice-call-empty">
            <div className="empty-icon">
              <svg width="96" height="96" viewBox="0 0 24 24" fill="currentColor" opacity="0.3">
                <path d="M11.383 3.07904C11.009 2.92504 10.579 3.01004 10.293 3.29604L6 8.00004H3C2.45 8.00004 2 8.45004 2 9.00004V15C2 15.55 2.45 16 3 16H6L10.293 20.71C10.579 20.996 11.009 21.082 11.383 20.927C11.757 20.772 12 20.407 12 20V4.00004C12 3.59304 11.757 3.22804 11.383 3.07904ZM14 5.00004V7.00004C16.757 7.00004 19 9.24304 19 12C19 14.757 16.757 17 14 17V19C17.86 19 21 15.86 21 12C21 8.14004 17.86 5.00004 14 5.00004ZM14 9.00004V15C15.654 15 17 13.654 17 12C17 10.346 15.654 9.00004 14 9.00004Z" />
              </svg>
            </div>
            <p className="empty-message">В ожидании других участников...</p>
          </div>
        )}
      </div>

      {/* Voice Controls */}
      <div className="voice-controls">
        <div className="voice-controls-wrapper">
          <button 
            className={`voice-control-btn ${isMuted ? 'muted' : ''}`}
            onClick={toggleMute}
            title={isMuted ? 'Включить микрофон' : 'Выключить микрофон'}
          >
            {isMuted ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6.7 11H5C5 12.19 5.34 13.3 5.9 14.28L7.13 13.05C6.86 12.43 6.7 11.74 6.7 11Z"/>
                <path d="M9.01 11.085C9.01 11.035 9.01 11.015 9.01 11C9.01 8.99 10.71 7.39 12.71 7.39C14.71 7.39 16.41 8.99 16.41 11C16.41 11.015 16.41 11.035 16.41 11.085L18.31 13.385C18.5 12.645 18.61 11.845 18.61 11C18.61 7.8 16.11 5.2 12.91 5.2C9.71 5.2 7.21 7.8 7.21 11C7.21 11.845 7.31 12.645 7.5 13.385L9.01 11.085Z"/>
                <path d="M11.7999 19.3101C13.7599 19.3101 15.3699 17.6201 15.6099 15.5401L11.7999 19.3101Z"/>
                <path d="M21 4.27L19.73 3L3 19.73L4.27 21L8.46 16.81C9.69 17.84 11.23 18.5 12.95 18.5C16.95 18.5 20.2 15.25 20.2 11.25H18.7C18.7 14.47 16.17 17 12.95 17C11.13 17 9.47 16.28 8.21 15.13L11.95 11.39V11.25C11.95 9.88 13.08 8.75 14.45 8.75C15.82 8.75 16.95 9.88 16.95 11.25V11.75H18.45V11.25C18.45 9.05 16.65 7.25 14.45 7.25C12.25 7.25 10.45 9.05 10.45 11.25V11.39L21 4.27Z"/>
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C11.45 2 11 2.45 11 3V11C11 11.55 11.45 12 12 12C12.55 12 13 11.55 13 11V3C13 2.45 12.55 2 12 2ZM18.91 11C18.91 14.14 16.44 16.73 13.41 16.97V20H10.59V16.97C7.56 16.73 5.09 14.14 5.09 11H6.91C6.91 13.76 9.24 16 12 16C14.76 16 17.09 13.76 17.09 11H18.91Z"/>
              </svg>
            )}
          </button>

          <button 
            className={`voice-control-btn ${!isAudioEnabled ? 'muted' : ''}`}
            onClick={toggleAudio}
            title={isAudioEnabled ? 'Отключить звук' : 'Включить звук'}
          >
            {!isAudioEnabled ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6.7 11H5C5 12.19 5.34 13.3 5.9 14.28L7.13 13.05C6.86 12.43 6.7 11.74 6.7 11Z"/>
                <path d="M16.5 12C16.5 14.21 14.71 16 12.5 16C10.29 16 8.5 14.21 8.5 12C8.5 9.79 10.29 8 12.5 8C14.71 8 16.5 9.79 16.5 12ZM19 12C19 8.13 15.87 5 12 5C8.13 5 5 8.13 5 12C5 15.87 8.13 19 12 19C15.87 19 19 15.87 19 12ZM21 4.27L19.73 3L3 19.73L4.27 21L21 4.27Z"/>
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M11.383 3.07904C11.009 2.92504 10.579 3.01004 10.293 3.29604L6 8.00004H3C2.45 8.00004 2 8.45004 2 9.00004V15C2 15.55 2.45 16 3 16H6L10.293 20.71C10.579 20.996 11.009 21.082 11.383 20.927C11.757 20.772 12 20.407 12 20V4.00004C12 3.59304 11.757 3.22804 11.383 3.07904ZM14 5.00004V7.00004C16.757 7.00004 19 9.24304 19 12C19 14.757 16.757 17 14 17V19C17.86 19 21 15.86 21 12C21 8.14004 17.86 5.00004 14 5.00004ZM14 9.00004V15C15.654 15 17 13.654 17 12C17 10.346 15.654 9.00004 14 9.00004Z" />
              </svg>
            )}
          </button>

          <div className="volume-control">
            <button 
              className="voice-control-btn"
              onClick={() => setShowVolumeSlider(!showVolumeSlider)}
              title="Громкость"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/>
              </svg>
            </button>
            {showVolumeSlider && (
              <div className="volume-slider-container">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={volume}
                  onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                  className="volume-slider"
                />
                <span className="volume-value">{Math.round(volume * 100)}%</span>
              </div>
            )}
          </div>

          <button 
            className="voice-control-btn disconnect-btn"
            onClick={handleClose}
            title="Отключиться"
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

