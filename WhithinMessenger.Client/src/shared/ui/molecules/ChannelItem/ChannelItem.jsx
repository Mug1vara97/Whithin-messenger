import React, { useState } from 'react';
import { Draggable } from '@hello-pangea/dnd';
import { FaCog } from 'react-icons/fa';
import { VolumeUp, VolumeOff, Mic, MicOff } from '@mui/icons-material';
import { useSimpleVoiceCall } from '@/entities/voice-call/hooks/useSimpleVoiceCall';
import './ChannelItem.css';

const ChannelItem = ({ 
  channel,
  index,
  isActive,
  onClick,
  onContextMenu,
  onSettings,
  isDragDisabled = false,
  userId,
  userName
}) => {
  const [isInVoiceChannel, setIsInVoiceChannel] = useState(false);
  const isVoiceChannel = channel.chatType === 4 || 
                        channel.typeId === 4 || 
                        channel.TypeId === 4 ||
                        channel.typeId === "44444444-4444-4444-4444-444444444444";
  
  const {
    isConnected,
    isMuted,
    isAudioEnabled,
    isSpeaking,
    connect,
    disconnect,
    joinRoom,
    leaveRoom,
    startAudio,
    stopAudio,
    toggleMute,
    toggleAudio
  } = useSimpleVoiceCall(userId, userName);

  const handleClick = () => {
    if (isVoiceChannel) {
      handleVoiceChannelClick();
    } else if (onClick) {
      onClick(channel);
    }
  };

  const handleVoiceChannelClick = async () => {
    if (isInVoiceChannel) {
      // Покинуть голосовой канал
      try {
        await leaveRoom();
        await disconnect();
        setIsInVoiceChannel(false);
      } catch (error) {
        console.error('Failed to leave voice channel:', error);
      }
    } else {
      // Присоединиться к голосовому каналу
      try {
        await connect();
        await joinRoom(channel.chatId || channel.ChatId);
        await startAudio();
        setIsInVoiceChannel(true);
      } catch (error) {
        console.error('Failed to join voice channel:', error);
      }
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
      if (isInVoiceChannel) {
        return <VolumeUp sx={{ fontSize: 16, width: 16, height: 16, color: isSpeaking ? '#43b581' : '#43b581' }} />;
      }
      return <VolumeOff sx={{ fontSize: 16, width: 16, height: 16 }} />;
    }
    return '#'; 
  };

  const getChannelName = () => {
    const name = channel.name || channel.Name || channel.groupName;
    if (isVoiceChannel && isInVoiceChannel) {
      return `${name} (Connected)`;
    }
    return name;
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
          className={`channel-item ${isActive ? 'active' : ''} ${snapshot.isDragging ? 'dragging' : ''}`}
          onClick={handleClick}
          onContextMenu={handleContextMenu}
          style={{
            ...provided.draggableProps.style,
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
            {isVoiceChannel && isInVoiceChannel && (
              <>
                <button
                  className="voice-control-button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleMute();
                  }}
                  aria-label={isMuted ? "Unmute" : "Mute"}
                  style={{ 
                    color: isMuted ? '#ed4245' : '#43b581',
                    marginRight: '4px'
                  }}
                >
                  {isMuted ? <MicOff sx={{ fontSize: 14 }} /> : <Mic sx={{ fontSize: 14 }} />}
                </button>
                <button
                  className="voice-control-button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleAudio();
                  }}
                  aria-label={isAudioEnabled ? "Disable Audio" : "Enable Audio"}
                  style={{ 
                    color: isAudioEnabled ? '#43b581' : '#ed4245',
                    marginRight: '4px'
                  }}
                >
                  {isAudioEnabled ? <VolumeUp sx={{ fontSize: 14 }} /> : <VolumeOff sx={{ fontSize: 14 }} />}
                </button>
              </>
            )}
            <button
              className="settings-button"
              onClick={handleSettingsClick}
              aria-label="Настройки канала"
            >
              <FaCog />
            </button>
          </div>
        </div>
      )}
    </Draggable>
  );
};

export default ChannelItem;
