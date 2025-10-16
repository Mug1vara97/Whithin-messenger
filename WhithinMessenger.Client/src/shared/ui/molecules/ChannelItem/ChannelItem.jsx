import React from 'react';
import { Draggable } from '@hello-pangea/dnd';
import { FaCog } from 'react-icons/fa';
import { VolumeUp } from '@mui/icons-material';
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
    if (channel.chatType === 4 || channel.typeId === 4 || channel.TypeId === 4) {
      return <VolumeUp sx={{ fontSize: 16, width: 16, height: 16 }} />; 
    }
    return '#'; 
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
            {channel.name || channel.Name || channel.groupName}
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

export default ChannelItem;
