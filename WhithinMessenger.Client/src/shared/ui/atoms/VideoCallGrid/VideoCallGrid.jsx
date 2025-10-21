import React, { useState, useEffect, useRef } from 'react';
import { useVideoCall } from '../../../../entities/video-call';
import './VideoCallGrid.css';

const VideoCallGrid = ({ 
  participants = [], 
  onParticipantClick,
  className = '' 
}) => {
  const {
    focusedParticipantId,
    currentPage,
    bottomPage,
    visibleBottomUsers,
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
    
    return (
      <div
        key={participant.id}
        className={`video-tile ${isFocused ? 'focused-tile' : ''} ${isSmall ? 'small-tile' : ''}`}
        onClick={() => handleParticipantClick(participant)}
      >
        <div className="tile-content">
          <div className="user-avatar">
            {participant.avatar ? (
              <img src={participant.avatar} alt={participant.name} />
            ) : (
              <div 
                className="avatar-placeholder"
                style={{ 
                  backgroundColor: getAvatarColor(participant.name),
                  width: '100%',
                  height: '100%',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: isSmall ? '20px' : '32px',
                  fontWeight: '600',
                  color: 'white'
                }}
              >
                {getInitials(participant.name)}
              </div>
            )}
          </div>
          <div className="user-info">
            <div className="user-name">{participant.name}</div>
            <div className="user-status">{participant.status}</div>
          </div>
        </div>
        <div className="tile-overlay">
          <div className="overlay-controls">
            <button className="control-btn">Настройки</button>
          </div>
        </div>
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

        <div className="video-grid" data-user-count={currentParticipants.length}>
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
