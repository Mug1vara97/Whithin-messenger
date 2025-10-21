import React, { useState, useEffect } from 'react';
import { useVoiceCall } from '../../../entities/voice-call/hooks';
import { VideoCallGrid } from '../../../shared/ui/atoms';
import { createParticipant } from '../../../entities/video-call';
import { Menu, MenuItem } from '@mui/material';
import MicIcon from '@mui/icons-material/Mic';
import MicOffIcon from '@mui/icons-material/MicOff';
import VideocamIcon from '@mui/icons-material/Videocam';
import ScreenShareIcon from '@mui/icons-material/ScreenShare';
import CallEndIcon from '@mui/icons-material/CallEnd';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import ChatIcon from '@mui/icons-material/Chat';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import NoiseAwareIcon from '@mui/icons-material/NoiseAware';
import NoiseControlOffIcon from '@mui/icons-material/NoiseControlOff';
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
    isNoiseSuppressed,
    noiseSuppressionMode,
    connect,
    disconnect,
    joinRoom,
    toggleMute,
    toggleAudio,
    toggleNoiseSuppression,
    changeNoiseSuppressionMode
  } = useVoiceCall(userId, userName);

  const [showChatPanel, setShowChatPanel] = useState(false);
  const [videoParticipants, setVideoParticipants] = useState([]);
  const [noiseSuppressMenuAnchor, setNoiseSuppressMenuAnchor] = useState(null);

  useEffect(() => {
    if (channelId && userId && userName) {
      connect().then(() => {
        joinRoom(channelId);
      }).catch((err) => {
        console.error('Connection error:', err);
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

  // Обработчики меню шумоподавления
  const handleNoiseSuppressionMenuClose = () => {
    setNoiseSuppressMenuAnchor(null);
  };

  const handleNoiseSuppressionModeSelect = async (mode) => {
    await changeNoiseSuppressionMode(mode);
    handleNoiseSuppressionMenuClose();
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
                      {/* Microphone with dropdown */}
                      <div className="attached-caret-button-container">
                        <button 
                          className={`center-button attached-button ${isMuted ? 'muted' : ''}`}
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
                        <div className={`context-menu-caret ${isMuted ? 'muted' : ''}`}>
                          <KeyboardArrowDownIcon sx={{ fontSize: 18 }} />
                        </div>
                      </div>

                      {/* Camera with dropdown */}
                      <div className="attached-caret-button-container">
                        <button 
                          className="center-button attached-button"
                          type="button" 
                          aria-label="Включить камеру"
                        >
                          <VideocamIcon sx={{ fontSize: 24 }} />
                        </button>
                        <div className="context-menu-caret">
                          <KeyboardArrowDownIcon sx={{ fontSize: 18 }} />
                        </div>
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
                          aria-label={isAudioEnabled ? 'Выключить звук' : 'Включить звук'}
                        >
                          <VolumeUpIcon sx={{ fontSize: 24 }} />
                        </button>
                      </div>

                      {/* Noise Suppression with dropdown */}
                      <div className="attached-caret-button-container">
                        <button 
                          className={`center-button attached-button ${isNoiseSuppressed ? '' : 'muted'}`}
                          type="button"
                          onClick={toggleNoiseSuppression}
                          aria-label={isNoiseSuppressed ? 'Выключить шумоподавление' : 'Включить шумоподавление'}
                        >
                          {isNoiseSuppressed ? (
                            <NoiseAwareIcon sx={{ fontSize: 24 }} />
                          ) : (
                            <NoiseControlOffIcon sx={{ fontSize: 24 }} />
                          )}
                        </button>
                        <div 
                          className={`context-menu-caret ${isNoiseSuppressed ? '' : 'muted'}`}
                          onClick={(e) => setNoiseSuppressMenuAnchor(e.currentTarget)}
                        >
                          <KeyboardArrowDownIcon sx={{ fontSize: 18 }} />
                        </div>
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

      {/* Noise Suppression Menu */}
      <Menu
        anchorEl={noiseSuppressMenuAnchor}
        open={Boolean(noiseSuppressMenuAnchor)}
        onClose={handleNoiseSuppressionMenuClose}
        anchorOrigin={{
          vertical: 'top',
          horizontal: 'center',
        }}
        transformOrigin={{
          vertical: 'bottom',
          horizontal: 'center',
        }}
        PaperProps={{
          sx: {
            backgroundColor: '#111214',
            color: '#f2f3f5',
            borderRadius: '8px',
            border: '1px solid #1e1f22',
            '& .MuiMenuItem-root': {
              fontSize: '14px',
              padding: '8px 16px',
              '&:hover': {
                backgroundColor: '#2e3035',
              },
              '&.Mui-selected': {
                backgroundColor: '#5865f2',
                '&:hover': {
                  backgroundColor: '#4752c4',
                },
              },
            },
          },
        }}
      >
        <MenuItem 
          onClick={() => handleNoiseSuppressionModeSelect('rnnoise')}
          selected={noiseSuppressionMode === 'rnnoise'}
        >
          RNNoise (AI-based)
        </MenuItem>
        <MenuItem 
          onClick={() => handleNoiseSuppressionModeSelect('speex')}
          selected={noiseSuppressionMode === 'speex'}
        >
          Speex (Classic)
        </MenuItem>
        <MenuItem 
          onClick={() => handleNoiseSuppressionModeSelect('noisegate')}
          selected={noiseSuppressionMode === 'noisegate'}
        >
          Noise Gate
        </MenuItem>
      </Menu>
    </div>
  );
};

export default VoiceCallView;