import React, { useEffect, useRef, useState } from 'react';
import { Draggable, Droppable } from '@hello-pangea/dnd';
import { FaCog, FaLock } from 'react-icons/fa';
import { VolumeUp } from '@mui/icons-material';
import HeadsetOffIcon from '@mui/icons-material/HeadsetOff';
import { useCallStore } from '../../../lib/stores/callStore';
import {
  getParticipantIsDeafened,
  getParticipantIsMuted,
  getParticipantIsSpeaking,
  useParticipantGlobalAudioStates,
  useParticipantMuteStates,
  useParticipantSpeakingStates,
} from '../../../lib/hooks/useParticipantSpeakingStates';
import { MEDIA_BASE_URL } from '../../../lib/constants/apiEndpoints';
import './ChannelItem.css';

const EMPTY_VOICE_PARTICIPANTS = [];

function selectVoiceChannelParticipants(state, channelId) {
  const normalizedChannelId = String(channelId);
  const currentRoomId = state.currentRoomId;
  const isCurrentChannel =
    currentRoomId === channelId || String(currentRoomId) === normalizedChannelId;

  const fromMap =
    state.voiceChannelParticipants?.get?.(channelId) ||
    state.voiceChannelParticipants?.get?.(normalizedChannelId);

  if (fromMap?.length > 0) {
    return fromMap;
  }

  if (!isCurrentChannel) {
    for (const [channelKey, participants] of state.voiceChannelParticipants?.entries?.() || []) {
      if (String(channelKey) === normalizedChannelId && participants?.length > 0) {
        return participants;
      }
    }
  }

  return isCurrentChannel ? state.participants : EMPTY_VOICE_PARTICIPANTS;
}

const areParticipantsEqual = (a, b) => {
  if (a === b) return true;
  if (!a || !b || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    const pA = a[i];
    const pB = b[i];
    if (!pB) return false;
    if (
      pA.odUserId !== pB.odUserId ||
      pA.userId !== pB.userId ||
      pA.isMuted !== pB.isMuted ||
      pA.isSpeaking !== pB.isSpeaking ||
      pA.isDeafened !== pB.isDeafened ||
      pA.isAudioDisabled !== pB.isAudioDisabled ||
      pA.isGlobalAudioMuted !== pB.isGlobalAudioMuted
    ) {
      return false;
    }
  }
  return true;
};

const ChannelItem = ({
  channel,
  index,
  unreadCount = 0,
  isActive,
  onClick,
  onContextMenu,
  onSettings,
  isDragDisabled = false,
}) => {
  const isVoiceChannel =
    channel.chatType === 4 ||
    channel.typeId === 4 ||
    channel.TypeId === 4 ||
    channel.typeId === '44444444-4444-4444-4444-444444444444';
  const isPrivate = channel.isPrivate === true || channel.IsPrivate === true;
  const channelId = channel.chatId || channel.ChatId;

  const participantSpeakingStates = useParticipantSpeakingStates();
  const participantMuteStates = useParticipantMuteStates();
  const participantGlobalAudioStates = useParticipantGlobalAudioStates();

  const [voiceParticipants, setVoiceParticipants] = useState(EMPTY_VOICE_PARTICIPANTS);
  const prevParticipantsRef = useRef(EMPTY_VOICE_PARTICIPANTS);

  useEffect(() => {
    if (!isVoiceChannel) {
      setVoiceParticipants(EMPTY_VOICE_PARTICIPANTS);
      prevParticipantsRef.current = EMPTY_VOICE_PARTICIPANTS;
      return undefined;
    }

    const syncParticipants = (state) => {
      const next = selectVoiceChannelParticipants(state, channelId);
      if (!areParticipantsEqual(next, prevParticipantsRef.current)) {
        prevParticipantsRef.current = next;
        setVoiceParticipants(next);
      }
    };

    syncParticipants(useCallStore.getState());
    return useCallStore.subscribe(syncParticipants);
  }, [isVoiceChannel, channelId]);

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

  const getChannelName = () => channel.name || channel.Name || channel.groupName;

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
              cursor: isDragDisabled ? 'default' : 'grab',
            }}
          >
            <span className="channel-icon">{getChannelIcon()}</span>
            <span className="channel-name">
              {getChannelName()}
              {isPrivate && <FaLock className="private-channel-icon" title="Приватный канал" />}
            </span>
            {unreadCount > 0 && !isActive && (
              <span className="channel-unread-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
            )}
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

          {isVoiceChannel && (
            <Droppable droppableId={`voice-channel-${channelId}`} type="VOICE_PARTICIPANT">
              {(droppableProvided, droppableSnapshot) => (
                <div
                  ref={droppableProvided.innerRef}
                  {...droppableProvided.droppableProps}
                  className={`voice-channel-participants ${droppableSnapshot.isDraggingOver ? 'dragging-over' : ''}`}
                >
                  {voiceParticipants.map((participant, participantIndex) => {
                    const odUserId = participant.odUserId || participant.userId;
                    const participantId = String(odUserId);
                    const isMutedLive = getParticipantIsMuted(
                      participantMuteStates,
                      { id: participantId },
                      false,
                      participant
                    );
                    const isDeafenedLive = getParticipantIsDeafened(
                      participantGlobalAudioStates,
                      { id: participantId },
                      false,
                      participant
                    );
                    const isSpeakingLive = getParticipantIsSpeaking(
                      participantSpeakingStates,
                      participantId,
                      {
                        isMuted: isMutedLive,
                        audioEnabled: !isDeafenedLive,
                        channelParticipant: participant,
                      }
                    );

                    return (
                      <Draggable
                        key={odUserId || participant.peerId}
                        draggableId={`voice-participant__${odUserId}__from__${channelId}`}
                        index={participantIndex}
                        isDragDisabled={false}
                      >
                        {(participantProvided, participantSnapshot) => (
                          <div
                            ref={participantProvided.innerRef}
                            {...participantProvided.draggableProps}
                            {...participantProvided.dragHandleProps}
                            className={`voice-participant ${isSpeakingLive ? 'speaking' : ''} ${isMutedLive ? 'muted' : ''} ${isDeafenedLive ? 'deafened' : ''} ${participantSnapshot.isDragging ? 'dragging' : ''}`}
                            style={participantProvided.draggableProps.style}
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
                                  backgroundColor: participant.avatarColor || '#5865f2',
                                }}
                              >
                                {getInitials(participant.userName)}
                              </span>
                            </div>
                            <span className="voice-participant-name">{participant.userName}</span>
                            <div className="voice-participant-status-icons">
                              {isMutedLive && (
                                <span className="voice-participant-muted-icon" title="Микрофон выключен">
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z" />
                                  </svg>
                                </span>
                              )}
                              {isDeafenedLive && (
                                <span className="voice-participant-deafened-icon" title="Звук выключен">
                                  <HeadsetOffIcon sx={{ fontSize: 14, width: 14, height: 14 }} />
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </Draggable>
                    );
                  })}
                  {droppableProvided.placeholder}
                </div>
              )}
            </Droppable>
          )}
        </div>
      )}
    </Draggable>
  );
};

export default ChannelItem;
