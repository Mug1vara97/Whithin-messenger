import React, { useState } from 'react';
import { Person, PersonOff, MoreVert, Check, Close } from '@mui/icons-material';
import UserAvatar from '../../atoms/UserAvatar';
import { Button } from '../../atoms/Button';
import './FriendItem.css';

const FriendItem = ({ 
  friend, 
  onRemoveFriend, 
  onStartChat,
  onAccept,
  onDecline,
  showActions = true,
  isRequest = false
}) => {
  const [showContextMenu, setShowContextMenu] = useState(false);
  const getStatusColor = (status) => {
    switch (status) {
      case 'Online':
        return '#4CAF50';
      case 'Inactive':
        return '#FF9800';
      case 'DoNotDisturb':
        return '#F44336';
      case 'Offline':
      default:
        return '#9E9E9E';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'Online':
        return 'В сети';
      case 'Inactive':
        return 'Неактивен';
      case 'DoNotDisturb':
        return 'Не беспокоить';
      case 'Offline':
      default:
        return 'Не в сети';
    }
  };

  const formatLastSeen = (lastSeen) => {
    if (!lastSeen) return '';
    
    const date = new Date(lastSeen);
    const now = new Date();
    const diffInHours = (now - date) / (1000 * 60 * 60);
    
    if (diffInHours < 1) {
      return 'только что';
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}ч назад`;
    } else {
      return date.toLocaleDateString();
    }
  };

  return (
    <div className="friend-item">
      <div className="friend-item__avatar">
        <UserAvatar
          username={friend.username || friend.requesterUsername}
          avatarUrl={friend.avatar || friend.requesterAvatar}
          avatarColor={friend.avatarColor || friend.requesterAvatarColor}
          size="medium"
        />
        {!isRequest && (
          <div 
            className="friend-item__status-indicator"
            style={{ backgroundColor: getStatusColor(friend.status) }}
          />
        )}
      </div>
      
      <div className="friend-item__info">
        <div className="friend-item__name">
          {friend.username || friend.requesterUsername}
        </div>
        {!isRequest && (
          <div className="friend-item__status">
            {friend.status === 'Offline' && friend.lastSeen 
              ? `Был в сети ${formatLastSeen(friend.lastSeen)}`
              : getStatusText(friend.status)
            }
          </div>
        )}
        {isRequest && (
          <div className="friend-item__request-info">
            Запрос в друзья
          </div>
        )}
        {friend.description && (
          <div className="friend-item__description">{friend.description}</div>
        )}
      </div>
      
      {showActions && (
        <div className="friend-item__actions">
          {isRequest ? (
            <>
              <button
                className="friend-item__action-button friend-item__action-button--accept"
                onClick={() => onAccept?.(friend.id)}
                title="Принять"
              >
                <Check />
              </button>
              <button
                className="friend-item__action-button friend-item__action-button--decline"
                onClick={() => onDecline?.(friend.id)}
                title="Отклонить"
              >
                <Close />
              </button>
            </>
          ) : (
            <>
              <button
                className="friend-item__action-button friend-item__action-button--message"
                onClick={() => onStartChat?.(friend.userId)}
                title="Написать сообщение"
              >
                <Person />
              </button>
              <button
                className="friend-item__action-button friend-item__action-button--more"
                onClick={() => setShowContextMenu(!showContextMenu)}
                title="Еще"
              >
                <MoreVert />
              </button>
            </>
          )}
        </div>
      )}
      
      {showContextMenu && (
        <div className="friend-item__context-menu">
          <button 
            className="friend-item__context-item"
            onClick={() => {
              onRemoveFriend?.(friend.userId);
              setShowContextMenu(false);
            }}
          >
            <PersonOff />
            Удалить из друзей
          </button>
        </div>
      )}
    </div>
  );
};

export default FriendItem;
