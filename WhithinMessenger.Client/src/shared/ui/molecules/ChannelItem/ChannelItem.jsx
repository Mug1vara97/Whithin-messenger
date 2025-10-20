import React, { useState } from 'react';
import { Draggable } from '@hello-pangea/dnd';
import { FaCog } from 'react-icons/fa';
import { VolumeUp, VolumeOff } from '@mui/icons-material';
import { VoiceCallWidget } from '@/widgets/voice-call';
import './ChannelItem.css';

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
      return <VolumeOff sx={{ fontSize: 16, width: 16, height: 16 }} />;
    }
    return '#';
  };

  const getChannelName = () => {
    return channel.name || channel.Name || channel.groupName;
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

// Добавляем VoiceChat компонент для голосовых каналов
const VoiceChannelItem = ({ channel, userId, userName, ...props }) => {
  const [showVoiceChat, setShowVoiceChat] = useState(false);
  const isVoiceChannel = channel.chatType === 4 || 
                        channel.typeId === 4 || 
                        channel.TypeId === 4 ||
                        channel.typeId === "44444444-4444-4444-4444-444444444444";

  if (!isVoiceChannel) {
    return <ChannelItem channel={channel} {...props} />;
  }

  return (
    <>
      <ChannelItem 
        channel={channel} 
        {...props}
        onClick={() => setShowVoiceChat(!showVoiceChat)}
      />
      {showVoiceChat && (
        <VoiceCallWidget
          channelId={channel.chatId || channel.ChatId}
          channelName={channel.name || channel.Name || channel.groupName}
          userId={userId}
          userName={userName}
          onClose={() => setShowVoiceChat(false)}
        />
      )}
    </>
  );
};

export default VoiceChannelItem;
