import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Draggable } from '@hello-pangea/dnd';
import { FaCog } from 'react-icons/fa';
import { VolumeUp, HeadsetOffIcon } from '@mui/icons-material';
import { useCallStore } from '../../../lib/stores/callStore';
import { MEDIA_BASE_URL } from '../../../lib/constants/apiEndpoints';
import './ChannelItem.css';

// Функция глубокого сравнения участников
const areParticipantsEqual = (a, b) => {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const pA = a[i];
    const pB = b[i];
    if (!pB) return false;
    if (pA.odUserId !== pB.odUserId || 
        pA.userId !== pB.userId ||
        pA.isMuted !== pB.isMuted || 
        pA.isSpeaking !== pB.isSpeaking ||
        pA.isDeafened !== pB.isDeafened ||
        pA.isAudioDisabled !== pB.isAudioDisabled) {
      return false;
    }
  }
  return true;
};

const ChannelItem = ({ 
  channel,
  index,
  isActive,
  onClick,
  onContextMenu,
  onSettings,
  isDragDisabled = false
}) => {
  const isVoiceChannel = channel.chatType === 4 || 
                        channel.typeId === 4 || 
                        channel.TypeId === 4 ||
                        channel.typeId === "44444444-4444-4444-4444-444444444444";

  const channelId = channel.chatId || channel.ChatId;

  // Локальное состояние для участников голосового канала
  const [voiceParticipants, setVoiceParticipants] = useState([]);
  const [speakingStates, setSpeakingStates] = useState(null);
  const prevParticipantsRef = useRef([]);
  
  // Функция получения участников из store
  const getParticipantsFromStore = useCallback(() => {
    if (!isVoiceChannel) return [];
    
    const state = useCallStore.getState();
    const currentRoomId = state.currentRoomId;
    const isCurrentChannel = currentRoomId === channelId;
    
    const fromMap = state.voiceChannelParticipants?.get?.(channelId);
    if (fromMap && fromMap.length > 0) {
      return fromMap;
    }
    return isCurrentChannel ? state.participants : [];
  }, [isVoiceChannel, channelId]);

  // Подписка на изменения store для голосовых каналов
  useEffect(() => {
    if (!isVoiceChannel) return;
    
    // Инициализируем начальное значение
    const initialParticipants = getParticipantsFromStore();
    setVoiceParticipants(initialParticipants);
    prevParticipantsRef.current = initialParticipants;
    setSpeakingStates(useCallStore.getState().participantSpeakingStates);
    
    // Подписываемся на изменения store
    const unsubscribe = useCallStore.subscribe((state) => {
      // Получаем новых участников
      const newParticipants = state.voiceChannelParticipants?.get?.(channelId) || [];
      const currentRoomId = state.currentRoomId;
      const isCurrentChannel = currentRoomId === channelId;
      
      // Если нет участников из Map, используем participants текущего канала
      const participantsToUse = newParticipants.length > 0 
        ? newParticipants 
        : (isCurrentChannel ? state.participants : []);
      
      // Сравниваем с предыдущими участниками
      if (!areParticipantsEqual(participantsToUse, prevParticipantsRef.current)) {
        prevParticipantsRef.current = participantsToUse;
        setVoiceParticipants([...participantsToUse]);
      }
      
      // Обновляем speaking states
      setSpeakingStates(state.participantSpeakingStates);
    });
    
    return () => unsubscribe();
  }, [isVoiceChannel, channelId, getParticipantsFromStore]);
  
  const participantSpeakingStates = speakingStates;

  const handleClick = () => {
    if (onClick) {
      onClick(channel);
    }
  };


  const handleContextMenu = (e) => {
    if (onContextMenu) {
      e.preventDefault();
      e.stopPropagation();
      onContextMenu(e, channel);
    }
  };

  const handleSettingsClick = (e) => {
    e.stopPropagation();
    if (onSettings) {
      onSettings(channel);
    }
  };

  const getChannelIcon = () => {
    if (isVoiceChannel) {
      return <VolumeUp sx={{ fontSize: 16, width: 16, height: 16 }} />;
    }
    return '#';
  };

  const getChannelName = () => {
    return channel.name || channel.Name || channel.groupName;
  };

  const getAvatarUrl = (avatar) => {
    if (!avatar) return null;
    if (avatar.startsWith('http')) return avatar;
    return `${MEDIA_BASE_URL}${avatar}`;
  };

  const getInitials = (name) => {
    if (!name) return '?';
    return name.charAt(0).toUpperCase();
  };

  return (
    <Draggable
      draggableId={`chat-${channel.chatId || channel.ChatId}`}
      index={index}
      isDragDisabled={isDragDisabled}
    >
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={`channel-item-wrapper ${isVoiceChannel && voiceParticipants.length > 0 ? 'has-participants' : ''}`}
          style={provided.draggableProps.style}
        >
          <div
            className={`channel-item ${isActive ? 'active' : ''} ${snapshot.isDragging ? 'dragging' : ''}`}
            onClick={handleClick}
            onContextMenu={handleContextMenu}
            style={{
              cursor: isDragDisabled ? 'default' : 'grab'
            }}
          >
            <span className="channel-icon">
              {getChannelIcon()}
            </span>
            <span className="channel-name">
              {getChannelName()}
            </span>
            <div className="channel-settings">
              <button
                className="settings-button"
                onClick={handleSettingsClick}
                aria-label="Настройки канала"
              >
                <FaCog />
              </button>
            </div>
          </div>
          
          {/* Участники голосового канала */}
          {isVoiceChannel && voiceParticipants.length > 0 && (
            <div className="voice-channel-participants">
              {voiceParticipants.map((participant) => {
                const odUserId = participant.odUserId || participant.userId;
                const isSpeaking = participant.isSpeaking || participantSpeakingStates?.get?.(odUserId) || false;
                const isDeafened = participant.isDeafened || participant.isAudioDisabled || participant.isGlobalAudioMuted;
                return (
                  <div 
                    key={odUserId || participant.peerId} 
                    className={`voice-participant ${isSpeaking ? 'speaking' : ''} ${participant.isMuted ? 'muted' : ''} ${isDeafened ? 'deafened' : ''}`}
                  >
                    <div className="voice-participant-avatar">
                      {participant.avatar ? (
                        <img 
                          src={getAvatarUrl(participant.avatar)} 
                          alt={participant.userName}
                          onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.nextSibling.style.display = 'flex';
                          }}
                        />
                      ) : null}
                      <span 
                        className="voice-participant-initials"
                        style={{ 
                          display: participant.avatar ? 'none' : 'flex',
                          backgroundColor: participant.avatarColor || '#5865f2'
                        }}
                      >
                        {getInitials(participant.userName)}
                      </span>
                    </div>
                    <span className="voice-participant-name">
                      {participant.userName}
                    </span>
                    <div className="voice-participant-status-icons">
                      {participant.isMuted && (
                        <span className="voice-participant-muted-icon" title="Микрофон выключен">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z"/>
                          </svg>
                        </span>
                      )}
                      {isDeafened && (
                        <span className="voice-participant-deafened-icon" title="Звук выключен">
                          <HeadsetOffIcon sx={{ fontSize: 14, width: 14, height: 14 }} />
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </Draggable>
  );
};

export default ChannelItem;
