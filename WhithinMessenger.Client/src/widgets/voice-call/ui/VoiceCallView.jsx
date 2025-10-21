import React, { useState, useEffect } from 'react';
import { useVoiceCall } from '../../../entities/voice-call/hooks';
import { VideoCallGrid } from '../../../shared/ui/atoms';
import { createParticipant } from '../../../entities/video-call';
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
    audioBlocked,
    error,
    connect,
    disconnect,
    joinRoom,
    toggleMute,
    toggleAudio
  } = useVoiceCall(userId, userName);

  const [isConnecting, setIsConnecting] = useState(true);
  const [showChatPanel, setShowChatPanel] = useState(false);
  const [videoParticipants, setVideoParticipants] = useState([]);

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

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  // Преобразуем участников голосового звонка в формат для видеосетки
  useEffect(() => {
    const videoParticipantsList = [
      createParticipant(userId, userName, null, 'online', 'host')
    ];
    
    // Добавляем всех остальных участников
    participants.forEach(participant => {
      videoParticipantsList.push(
        createParticipant(
          participant.userId || participant.id || participant.name, 
          participant.name, 
          participant.avatar || null, 
          'online', 
          'participant'
        )
      );
    });
    
    console.log('Video participants updated:', videoParticipantsList);
    setVideoParticipants(videoParticipantsList);
  }, [participants, userId, userName]);


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
    <div className="voice-call-container">
      {/* Main Wrapper */}
      <div className="call-container">
        <div className="root-idle">
          <div className="video-grid-wrapper">
            {/* Scroller */}
            <div className="scroller">
              <div className="list-items">
                {/* Error Banner */}
                {error && (
                  <div className="error-banner">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                    </svg>
                    <span>{error}</span>
                  </div>
                )}

                {/* Audio Blocked Banner */}
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

                {/* Video Call Grid */}
                {(participants.length > 0 || isConnected) && (
                  <div className="video-call-grid-container">
                    <VideoCallGrid 
                      participants={videoParticipants}
                      onParticipantClick={(participant) => {
                        console.log('Clicked participant:', participant);
                      }}
                    />
                  </div>
                )}

                {/* Empty State */}
                {participants.length === 0 && !isConnecting && isConnected && (
                  <div className="participants-row">
                    <div className="tile-wrapper empty-tile">
                      <div className="tile-sizer">
                        <div className="single-user-root">
                          <img className="empty-art" alt="" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='184' height='128' viewBox='0 0 184 128' fill='none'%3E%3Cg opacity='0.3'%3E%3Cpath d='M92 24C78.7452 24 68 34.7452 68 48V72C68 85.2548 78.7452 96 92 96C105.255 96 116 85.2548 116 72V48C116 34.7452 105.255 24 92 24Z' fill='%23949ba4'/%3E%3Cpath d='M60 64V72C60 89.6731 74.3269 104 92 104C109.673 104 124 89.6731 124 72V64H132V72C132 94.0914 114.091 112 92 112C69.9086 112 52 94.0914 52 72V64H60Z' fill='%23949ba4'/%3E%3Crect x='88' y='112' width='8' height='16' fill='%23949ba4'/%3E%3Crect x='72' y='120' width='40' height='8' rx='4' fill='%23949ba4'/%3E%3C/g%3E%3C/svg%3E"/>
                          <div className="empty-stack">
                            <button className="empty-button" type="button">
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M13 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"/>
                                <path d="M3 5v-.75C3 3.56 3.56 3 4.25 3s1.24.56 1.33 1.25C6.12 8.65 9.46 12 13 12h1a8 8 0 0 1 8 8 2 2 0 0 1-2 2 .21.21 0 0 1-.2-.15 7.65 7.65 0 0 0-1.32-2.3c-.15-.2-.42-.06-.39.17l.25 2c.02.15-.1.28-.25.28H9a2 2 0 0 1-2-2v-2.22c0-1.57-.67-3.05-1.53-4.37A15.85 15.85 0 0 1 3 5Z"/>
                              </svg>
                              <span>Пригласить друзей</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Voice Controls */}
            <div className="video-controls">
              <div className="gradient-top"></div>
              <div className="gradient-bottom"></div>
              
              {/* Top Controls */}
              <div className="top-controls">
                <div className="header-wrapper">
                  <div className="header-bar">
                    <div className="header-children">
                      <div className="channel-title">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 3a1 1 0 0 0-1-1h-.06a1 1 0 0 0-.74.32L5.92 7H3a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h2.92l4.28 4.68a1 1 0 0 0 .74.32H11a1 1 0 0 0 1-1V3ZM15.1 20.75c-.58.14-1.1-.33-1.1-.92v-.03c0-.5.37-.92.85-1.05a7 7 0 0 0 0-13.5A1.11 1.11 0 0 1 14 4.2v-.03c0-.6.52-1.06 1.1-.92a9 9 0 0 1 0 17.5Z"/>
                          <path d="M15.16 16.51c-.57.28-1.16-.2-1.16-.83v-.14c0-.43.28-.8.63-1.02a3 3 0 0 0 0-5.04c-.35-.23-.63-.6-.63-1.02v-.14c0-.63.59-1.1 1.16-.83a5 5 0 0 1 0 9.02Z"/>
                        </svg>
                        <span>{channelName}</span>
                      </div>
                    </div>
                    <div className="toolbar">
                      <button 
                        className="toolbar-button" 
                        type="button" 
                        aria-label="Показать чат"
                        onClick={() => setShowChatPanel(!showChatPanel)}
                      >
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 22a10 10 0 1 0-8.45-4.64c.13.19.11.44-.04.61l-2.06 2.37A1 1 0 0 0 2.2 22H12Z"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Controls */}
              <div className="bottom-controls">
                <div className="edge-controls left"></div>
                <div className="center-controls">
                  <div className="wrapper">
                    <div className="button-section">
                      {/* Microphone */}
                      <div className="attached-button-container">
                        <button 
                          className={`center-button ${isMuted ? 'muted' : ''}`}
                          type="button" 
                          aria-label={isMuted ? 'Включить микрофон' : 'Заглушить'}
                          onClick={toggleMute}
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
                      </div>

                      {/* Camera */}
                      <div className="attached-button-container">
                        <button 
                          className="center-button"
                          type="button" 
                          aria-label="Включить камеру"
                        >
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M2 5a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v.5V6v.5V7v7a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3V5Z"/>
                            <path d="M20.364 5.87a1 1 0 0 1 1.637.77v10.72a1 1 0 0 1-1.637.77l-2.727-2.18V8.05l2.727-2.18Z"/>
                          </svg>
                        </button>
                      </div>
                    </div>

                    <div className="button-section">
                      {/* Screen Share */}
                      <div className="attached-button-container control-button">
                        <button 
                          className="center-button"
                          type="button" 
                          aria-label="Продемонстрируйте свой экран"
                        >
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M2 4.5A2.5 2.5 0 0 1 4.5 2h15A2.5 2.5 0 0 1 22 4.5v10a2.5 2.5 0 0 1-2.5 2.5h-15A2.5 2.5 0 0 1 2 14.5v-10Z"/>
                            <path d="M10.94 18.94 11.5 18h1l.56.94a1 1 0 1 0 1.71-1.02l-.98-1.64c-.1-.16-.26-.28-.44-.33L14 16a2 2 0 0 0 2-2H8a2 2 0 0 0 2 2l.65-.05a.86.86 0 0 0-.44.33l-.98 1.64a1 1 0 0 0 1.71 1.02Z"/>
                          </svg>
                        </button>
                      </div>

                      {/* Activities */}
                      <div className="button-container">
                        <div className="attached-button-container">
                          <button 
                            className="center-button"
                            type="button"
                          >
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                              <path fillRule="evenodd" d="M21 7a3 3 0 0 0-3-3h-1a1 1 0 0 0-1 1v1H8V5a1 1 0 0 0-1-1H6a3 3 0 0 0-3 3v11a4 4 0 0 0 4 4h10a4 4 0 0 0 4-4V7Z" clipRule="evenodd"/>
                            </svg>
                          </button>
                        </div>
                      </div>

                      {/* Audio Settings */}
                      <div className="attached-button-container">
                        <button 
                          className={`center-button ${!isAudioEnabled ? 'muted' : ''}`}
                          type="button"
                          onClick={toggleAudio}
                        >
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M11.383 3.07904C11.009 2.92504 10.579 3.01004 10.293 3.29604L6 8.00004H3C2.45 8.00004 2 8.45004 2 9.00004V15C2 15.55 2.45 16 3 16H6L10.293 20.71C10.579 20.996 11.009 21.082 11.383 20.927C11.757 20.772 12 20.407 12 20V4.00004C12 3.59304 11.757 3.22804 11.383 3.07904ZM14 5.00004V7.00004C16.757 7.00004 19 9.24304 19 12C19 14.757 16.757 17 14 17V19C17.86 19 21 15.86 21 12C21 8.14004 17.86 5.00004 14 5.00004Z"/>
                          </svg>
                        </button>
                      </div>

                      {/* More Options */}
                      <div className="attached-button-container">
                        <button 
                          className="center-button"
                          type="button" 
                          aria-label="Другие настройки"
                        >
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                            <path fillRule="evenodd" d="M4 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm10-2a2 2 0 1 1-4 0 2 2 0 0 1 4 0Zm8 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z" clipRule="evenodd"/>
                          </svg>
                        </button>
                      </div>
                    </div>

                    {/* Disconnect Button */}
                    <div className="disconnect-button-wrapper">
                      <div className="attached-button-container">
                        <button 
                          className="center-button disconnect"
                          type="button" 
                          aria-label="Отключиться"
                          onClick={handleClose}
                        >
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08c-.18-.17-.29-.42-.29-.7 0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28-.79-.74-1.69-1.36-2.67-1.85-.33-.16-.56-.5-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z"/>
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="edge-controls right">
                  <button className="right-tray-icon" type="button" aria-label="В отдельном окне">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M15 2a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v6a1 1 0 1 1-2 0V4.41l-4.3 4.3a1 1 0 1 1-1.4-1.42L19.58 3H16a1 1 0 0 1-1-1Z"/>
                      <path d="M5 2a3 3 0 0 0-3 3v14a3 3 0 0 0 3 3h14a3 3 0 0 0 3-3v-6a1 1 0 1 0-2 0v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h6a1 1 0 1 0 0-2H5Z"/>
                    </svg>
                  </button>
                  <button className="right-tray-icon" type="button" aria-label="Полноэкранный режим">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M4 6c0-1.1.9-2 2-2h3a1 1 0 0 0 0-2H6a4 4 0 0 0-4 4v3a1 1 0 0 0 2 0V6ZM4 18c0 1.1.9 2 2 2h3a1 1 0 1 1 0 2H6a4 4 0 0 1-4-4v-3a1 1 0 1 1 2 0v3ZM18 4a2 2 0 0 1 2 2v3a1 1 0 1 0 2 0V6a4 4 0 0 0-4-4h-3a1 1 0 1 0 0 2h3ZM20 18a2 2 0 0 1-2 2h-3a1 1 0 1 0 0 2h3a4 4 0 0 0 4-4v-3a1 1 0 1 0-2 0v3Z"/>
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VoiceCallView;