import React, { useRef, useMemo, useState, useEffect, useCallback } from 'react';
import MicOffIcon from '@mui/icons-material/MicOff';
import MicIcon from '@mui/icons-material/Mic';
import HeadsetOffIcon from '@mui/icons-material/HeadsetOff';
import SettingsIcon from '@mui/icons-material/Settings';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import VolumeOffIcon from '@mui/icons-material/VolumeOff';
import { Slider } from '@mui/material';
import './VideoCallGrid.css';

const VideoCallGrid = ({ 
  participants = [], 
  onParticipantClick,
  className = '',
  userVolumes = new Map(),
  userMutedStates = new Map(),
  showVolumeSliders = new Map(),
  onToggleUserMute,
  onChangeUserVolume,
  onToggleVolumeSlider,
  screenShareStream = null,
  isScreenSharing = false,
  screenShareParticipant = null,
  remoteScreenShares = new Map(),
  forceGridMode = false,
  hideBottomUsers = false
}) => {
  const bottomGridRef = useRef(null);

  const getInitials = (name) => {
    if (!name) return '?';
    const words = name.trim().split(' ');
    if (words.length === 1) {
      return name.charAt(0).toUpperCase();
    }
    return (words[0].charAt(0) + words[words.length - 1].charAt(0)).toUpperCase();
  };

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

  // Создаем расширенный список участников, включая демонстрации экрана
  const extendedParticipants = useMemo(() => {
    const screenShareParticipants = [];
    
    // Локальная демонстрация экрана
    if (isScreenSharing && screenShareStream && screenShareParticipant) {
      screenShareParticipants.push({
        id: `screen-share-local-${screenShareParticipant.id}`,
        name: screenShareParticipant.name,
        isScreenShare: true,
        isLocal: true,
        stream: screenShareStream
      });
    }
    
    // Удаленные демонстрации экрана
    Array.from(remoteScreenShares.values()).forEach((screenShare) => {
      screenShareParticipants.push({
        id: `screen-share-remote-${screenShare.producerId}`,
        name: screenShare.userName,
        isScreenShare: true,
        isLocal: false,
        stream: screenShare.stream,
        producerId: screenShare.producerId
      });
    });
    
    const extended = [...participants, ...screenShareParticipants];
    return extended;
  }, [participants, isScreenSharing, screenShareStream, screenShareParticipant, remoteScreenShares]);

  // Локальная логика вместо useVideoCall
  const [focusedParticipantId, setFocusedParticipantId] = useState(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [bottomPage, setBottomPage] = useState(0);
  const [visibleBottomUsers] = useState(6);

  const isFocusedMode = focusedParticipantId !== null;
  const focusedParticipant = extendedParticipants.find(p => p.id === focusedParticipantId);

  // Вычисляемые значения
  const totalPages = Math.ceil(extendedParticipants.length / 6);
  const totalBottomPages = Math.ceil(extendedParticipants.length / visibleBottomUsers);
  
  // const currentParticipants = extendedParticipants.slice(currentPage * 6, (currentPage + 1) * 6);

  // Действия
  const focusParticipant = useCallback((participantId) => {
    if (focusedParticipantId === participantId) {
      setFocusedParticipantId(null);
      setBottomPage(0);
    } else {
      setFocusedParticipantId(participantId);
      setBottomPage(0);
    }
  }, [focusedParticipantId]);

  const goToPage = (page) => {
    setCurrentPage(page);
  };

  const goToBottomPage = (page) => {
    setBottomPage(page);
  };

  // Автоматический фокус на вебкамеру
  useEffect(() => {
    if (!isFocusedMode) {
      // Сначала ищем удаленного участника с вебкамерой
      let videoParticipant = extendedParticipants.find(p => 
        p.isVideoEnabled && p.videoStream && !p.isCurrentUser
      );
      
      // Если удаленного участника с вебкамерой нет, фокусируемся на текущем пользователе
      if (!videoParticipant) {
        videoParticipant = extendedParticipants.find(p => 
          p.isVideoEnabled && p.videoStream && p.isCurrentUser
        );
      }
      
      if (videoParticipant) {
        console.log('VideoCallGrid: Auto-focusing on video participant:', videoParticipant.id, 'isCurrentUser:', videoParticipant.isCurrentUser);
        focusParticipant(videoParticipant.id);
      }
    }
  }, [extendedParticipants, isFocusedMode, focusParticipant]);

  const handleParticipantClick = (participant) => {
    focusParticipant(participant.id);
    onParticipantClick?.(participant);
  };

  const handlePrevPage = () => {
    goToPage(Math.max(0, currentPage - 1));
  };

  const handleNextPage = () => {
    goToPage(Math.min(totalPages - 1, currentPage + 1));
  };

  const handlePrevBottomPage = () => {
    goToBottomPage(Math.max(0, bottomPage - 1));
  };

  const handleNextBottomPage = () => {
    goToBottomPage(Math.min(totalBottomPages - 1, bottomPage + 1));
  };

  const renderParticipantTile = (participant, isSmall = false) => {
    const isFocused = participant.id === focusedParticipantId;
    const isMuted = participant.isMuted || false;
    const isSpeaking = participant.isSpeaking || false;
    const isAudioMuted = userMutedStates.get(participant.id) || false;
    const volume = userVolumes.get(participant.id) || 100;
    const showSlider = showVolumeSliders.get(participant.id) || false;
    const isScreenShare = participant.isScreenShare || false;
    
    const handleVolumeClick = (e) => {
      e.stopPropagation();
      if (onToggleUserMute) {
        onToggleUserMute(participant.id);
      }
    };

    const handleVolumeRightClick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (onToggleVolumeSlider) {
        onToggleVolumeSlider(participant.id);
      }
    };

    const handleSliderChange = (e, newValue) => {
      e.stopPropagation();
      if (onChangeUserVolume) {
        onChangeUserVolume(participant.id, newValue);
      }
    };
    
    return (
      <div
        key={participant.id}
        className={`video-tile ${isFocused ? 'focused-tile' : ''} ${isSmall ? 'small-tile' : ''} ${isSpeaking ? 'speaking' : ''}`}
        onClick={() => handleParticipantClick(participant)}
      >
        <div className={`tile-content ${isScreenShare ? 'screen-share-content' : ''}`}>
          {/* Background with avatar, video, or screen share */}
          <div className="tile-background">
            {isScreenShare ? (
              <video
                ref={(video) => {
                  if (video && participant.stream) {
                    video.srcObject = participant.stream;
                    video.play().catch(error => {
                      // Игнорируем ошибки воспроизведения (AbortError)
                      if (error.name !== 'AbortError') {
                        console.warn('Video play error:', error);
                      }
                    });
                  }
                }}
                className="tile-video"
                autoPlay
                muted
                playsInline
              />
            ) : participant.isVideoEnabled && participant.videoStream ? (
              <video
                ref={(video) => {
                  if (video && participant.videoStream) {
                    video.srcObject = participant.videoStream;
                    video.play().catch(error => {
                      if (error.name !== 'AbortError') {
                        console.warn('Camera video play error:', error);
                      }
                    });
                  }
                }}
                className={`tile-video ${participant.isCurrentUser ? 'tile-video-mirrored' : ''}`}
                autoPlay
                muted
                playsInline
              />
            ) : participant.avatar ? (
              <img src={participant.avatar} alt={participant.name} className="tile-avatar-bg" />
            ) : (
              <div 
                className="avatar-placeholder"
                style={{ 
                  backgroundColor: getAvatarColor(participant.name),
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: isSmall ? '40px' : '80px',
                  fontWeight: '600',
                  color: 'white'
                }}
              >
                {getInitials(participant.name)}
              </div>
            )}
          </div>

          {/* Bottom overlay with name and status */}
          <div className="tile-bottom-overlay">
            <div className="bottom-info">
              {isScreenShare ? (
                <div className="screen-share-status">
                  <span className="status-indicator screen-share-indicator"></span>
                  <span className="status-text">Демонстрация экрана</span>
                  {/* Показываем индикатор звука для демонстрации экрана */}
                  <div className="screen-share-audio-indicator">
                    <VolumeUpIcon sx={{ fontSize: isSmall ? 14 : 16, color: '#5865f2' }} />
                  </div>
                  {/* Кнопка закрытия убрана по требованию пользователя */}
                </div>
              ) : (
                <>
                  <div className={`mic-status ${isMuted ? 'muted' : isSpeaking ? 'speaking' : 'silent'}`}>
                    {isMuted ? (
                      <MicOffIcon sx={{ fontSize: isSmall ? 16 : 18, color: '#ed4245' }} />
                    ) : isSpeaking ? (
                      <MicIcon sx={{ fontSize: isSmall ? 16 : 18, color: '#3ba55c' }} />
                    ) : (
                      <MicIcon sx={{ fontSize: isSmall ? 16 : 18, color: '#B5BAC1' }} />
                    )}
                  </div>
                  {participant.isGlobalAudioMuted && (
                    <div className="headset-status">
                      <HeadsetOffIcon sx={{ fontSize: isSmall ? 16 : 18, color: '#ed4245' }} />
                    </div>
                  )}
                </>
              )}
              <span className="participant-name">{participant.name}</span>
            </div>
            
            {/* Volume controls */}
            <div className="tile-volume-controls">
              <button 
                className={`tile-volume-btn ${
                  isAudioMuted || volume === 0
                    ? 'muted'
                    : isSpeaking
                    ? 'speaking'
                    : 'silent'
                }`}
                onClick={handleVolumeClick}
                onContextMenu={handleVolumeRightClick}
                title="ЛКМ - мут, ПКМ - слайдер"
              >
                {isAudioMuted || volume === 0 ? (
                  <VolumeOffIcon sx={{ fontSize: isSmall ? 14 : 16 }} />
                ) : (
                  <VolumeUpIcon sx={{ fontSize: isSmall ? 14 : 16 }} />
                )}
              </button>

              {/* Volume slider */}
              {showSlider && (
                <div className="volume-slider-container" onClick={(e) => e.stopPropagation()}>
                  <Slider
                    value={volume}
                    onChange={handleSliderChange}
                    orientation="vertical"
                    min={0}
                    max={100}
                    step={1}
                    size="small"
                    sx={{
                      color: '#5865f2',
                      height: '80px',
                      '& .MuiSlider-track': {
                        backgroundColor: '#5865f2',
                      },
                      '& .MuiSlider-thumb': {
                        backgroundColor: '#fff',
                        width: 12,
                        height: 12,
                        '&:hover': {
                          boxShadow: '0 0 0 8px rgba(88, 101, 242, 0.16)',
                        },
                      },
                    }}
                  />
                  <span className="volume-percentage">{volume}%</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Border for speaking/hover */}
        <div className="tile-border"></div>
      </div>
    );
  };

  // Режим фокусировки (но не принудительная сетка)
  if (isFocusedMode && !forceGridMode) {
    // console.log('Focused mode:', { 
    //   focusedParticipantId, 
    //   focusedParticipant,
    //   isScreenShare: focusedParticipant?.isScreenShare 
    // });
    
    return (
      <div className={`video-call-container focused-mode ${className}`}>
        <div className="focused-view">
          <div className="focused-user-wrapper">
            {focusedParticipant && renderParticipantTile(focusedParticipant, false)}
          </div>
          
          {!hideBottomUsers && (
            <div className="bottom-users-container">
              {totalBottomPages > 1 && bottomPage > 0 && (
                <button 
                  className="pagination-arrow pagination-arrow-left" 
                  onClick={handlePrevBottomPage}
                  aria-label="Предыдущая страница"
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              )}

              <div className="bottom-users-grid" ref={bottomGridRef}>
                {/* Все участники, включая демонстрации экрана, через extendedParticipants */}
                {extendedParticipants.map((participant) => renderParticipantTile(participant, true))}
              </div>

              {totalBottomPages > 1 && bottomPage < totalBottomPages - 1 && (
                <button 
                  className="pagination-arrow pagination-arrow-right" 
                  onClick={handleNextBottomPage}
                  aria-label="Следующая страница"
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path d="M9 18L15 12L9 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Обычный режим (сетка)
  return (
    <div className={`video-call-container ${className}`}>
      <div className="video-grid-wrapper">
        {totalPages > 1 && currentPage > 0 && (
          <button 
            className="pagination-arrow pagination-arrow-left" 
            onClick={handlePrevPage}
            aria-label="Предыдущая страница"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        )}

        <div className="video-grid" data-user-count={extendedParticipants.length}>
          {/* Все участники, включая демонстрации экрана, через extendedParticipants */}

          {extendedParticipants.map((participant) => renderParticipantTile(participant, false))}
        </div>

        {totalPages > 1 && currentPage < totalPages - 1 && (
          <button 
            className="pagination-arrow pagination-arrow-right" 
            onClick={handleNextPage}
            aria-label="Следующая страница"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M9 18L15 12L9 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        )}
      </div>

      {totalPages > 1 && (
        <div className="pagination-info">
          Страница {currentPage + 1} из {totalPages}
        </div>
      )}
    </div>
  );
};

export default VideoCallGrid;
