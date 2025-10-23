import React, { useRef } from 'react';
import { useVideoCall } from '../../../../entities/video-call';
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
  remoteScreenShares = new Map()
}) => {
  const {
    focusedParticipantId,
    currentPage,
    bottomPage,
    totalPages,
    totalBottomPages,
    currentParticipants,
    currentBottomParticipants,
    focusParticipant,
    goToPage,
    goToBottomPage,
    isFocusedMode,
    focusedParticipant
  } = useVideoCall(participants);

  const bottomGridRef = useRef(null);

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

  const renderParticipantTile = (participant, isSmall = false) => {
    const isFocused = participant.id === focusedParticipantId;
    const isMuted = participant.isMuted || false;
    const isAudioEnabled = participant.isAudioEnabled !== undefined ? participant.isAudioEnabled : true;
    const isSpeaking = participant.isSpeaking || false;
    const isAudioMuted = userMutedStates.get(participant.id) || false;
    const volume = userVolumes.get(participant.id) || 100;
    const showSlider = showVolumeSliders.get(participant.id) || false;
    
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
        <div className="tile-content">
          {/* Background with avatar or video */}
          <div className="tile-background">
            {participant.avatar ? (
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

          {/* Bottom overlay with name and mic status */}
          <div className="tile-bottom-overlay">
            <div className="bottom-info">
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

  // Режим фокусировки
  if (isFocusedMode) {
    return (
      <div className={`video-call-container focused-mode ${className}`}>
        <div className="focused-view">
          <div className="focused-user-wrapper">
            {focusedParticipant && renderParticipantTile(focusedParticipant, false)}
          </div>
          
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
              {currentBottomParticipants.map((participant) => renderParticipantTile(participant, true))}
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

        <div className="video-grid" data-user-count={currentParticipants.length + ((isScreenSharing && screenShareStream) ? 1 : 0) + remoteScreenShares.size}>
          {/* Локальная демонстрация экрана */}
          {isScreenSharing && screenShareStream && (
            <div className="video-tile screen-share-tile">
              <div className="tile-border"></div>
              <div className="tile-content">
                <video
                  ref={(video) => {
                    if (video && screenShareStream) {
                      video.srcObject = screenShareStream;
                      video.play();
                    }
                  }}
                  className="tile-video"
                  autoPlay
                  muted
                  playsInline
                />
                <div className="tile-overlay">
                  <div className="tile-info">
                    <div className="tile-name">
                      {screenShareParticipant?.name || 'Unknown'}
                    </div>
                    <div className="tile-status screen-share-status">
                      <span className="status-indicator screen-share-indicator"></span>
                      Демонстрация экрана
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* Удаленные демонстрации экрана */}
          {Array.from(remoteScreenShares.values()).map((screenShare) => (
            <div key={screenShare.producerId} className="video-tile screen-share-tile">
              <div className="tile-border"></div>
              <div className="tile-content">
                <video
                  ref={(video) => {
                    if (video && screenShare.stream) {
                      video.srcObject = screenShare.stream;
                      video.play();
                    }
                  }}
                  className="tile-video"
                  autoPlay
                  muted
                  playsInline
                />
                <div className="tile-overlay">
                  <div className="tile-info">
                    <div className="tile-name">
                      {screenShare.userName || 'Unknown'}
                    </div>
                    <div className="tile-status screen-share-status">
                      <span className="status-indicator screen-share-indicator"></span>
                      Демонстрация экрана
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
          
          {currentParticipants.map((participant) => renderParticipantTile(participant, false))}
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
