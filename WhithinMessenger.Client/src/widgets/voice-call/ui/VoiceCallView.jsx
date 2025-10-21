import React, { useState, useEffect } from 'react';
import { useVoiceCall } from '../../../entities/voice-call/hooks';
import { VideoCallGrid } from '../../../shared/ui/atoms';
import { createParticipant } from '../../../entities/video-call';
import MicIcon from '@mui/icons-material/Mic';
import MicOffIcon from '@mui/icons-material/MicOff';
import VideocamIcon from '@mui/icons-material/Videocam';
import ScreenShareIcon from '@mui/icons-material/ScreenShare';
import CallEndIcon from '@mui/icons-material/CallEnd';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import ChatIcon from '@mui/icons-material/Chat';
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
    // Текущий пользователь (хост)
    const currentUser = createParticipant(userId, userName, null, 'online', 'host');
    currentUser.isMuted = isMuted;
    currentUser.isSpeaking = false; // Можно добавить логику определения говорит ли пользователь
    
    const videoParticipantsList = [currentUser];
    
    // Добавляем всех остальных участников
    participants.forEach(participant => {
      const videoParticipant = createParticipant(
        participant.userId || participant.id || participant.name, 
        participant.name, 
        participant.avatar || null, 
        'online', 
        'participant'
      );
      videoParticipant.isMuted = participant.isMuted || false;
      videoParticipant.isSpeaking = participant.isSpeaking || false;
      videoParticipantsList.push(videoParticipant);
    });
    
    console.log('Video participants updated:', videoParticipantsList);
    setVideoParticipants(videoParticipantsList);
  }, [participants, userId, userName, isMuted]);


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
                        <ChatIcon sx={{ fontSize: 24 }} />
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
                            <MicOffIcon sx={{ fontSize: 24 }} />
                          ) : (
                            <MicIcon sx={{ fontSize: 24 }} />
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
                          <VideocamIcon sx={{ fontSize: 24 }} />
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
                          <ScreenShareIcon sx={{ fontSize: 24 }} />
                        </button>
                      </div>

                      {/* Audio Settings */}
                      <div className="attached-button-container">
                        <button 
                          className={`center-button ${!isAudioEnabled ? 'muted' : ''}`}
                          type="button"
                          onClick={toggleAudio}
                        >
                          <VolumeUpIcon sx={{ fontSize: 24 }} />
                        </button>
                      </div>

                      {/* More Options */}
                      <div className="attached-button-container">
                        <button 
                          className="center-button"
                          type="button" 
                          aria-label="Другие настройки"
                        >
                          <MoreVertIcon sx={{ fontSize: 24 }} />
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
                          <CallEndIcon sx={{ fontSize: 24 }} />
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