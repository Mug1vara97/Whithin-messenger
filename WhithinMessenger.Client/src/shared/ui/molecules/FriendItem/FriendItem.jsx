import React, { useState } from 'react';
import { Person, PersonOff, MoreVert, Check, Close, Block } from '@mui/icons-material';
import UserAvatar from '../../atoms/UserAvatar';
import { UserAvatarPresenceDot } from '../../atoms/UserAvatar';
import { Button } from '../../atoms/Button';
import { useProfileModal } from '../../../lib/contexts/ProfileModalContext';
import { getUserStatusLabel, normalizeUserStatus, PRESENCE_STATUS } from '../../../lib/utils/userStatus';
import './FriendItem.css';

const FriendItem = ({ 
  friend, 
  onRemoveFriend, 
  onStartChat,
  onAccept,
  onDecline,
  onUnblock,
  showActions = true,
  isRequest = false,
  isBlocked = false,
}) => {
  const [showContextMenu, setShowContextMenu] = useState(false);
  const { openProfile } = useProfileModal();

  const profileUserId = friend.userId || friend.requesterUserId;
  const profileUsername = friend.username || friend.requesterUsername;

  const handleOpenProfile = () => {
    if (!profileUserId) return;
    openProfile(profileUserId, profileUsername, friend.status);
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
      <div
        className="friend-item__profile-trigger"
        role="button"
        tabIndex={0}
        onClick={handleOpenProfile}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            handleOpenProfile();
          }
        }}
      >
        <div className="user-avatar-slot friend-item__avatar">
          <UserAvatar
            username={profileUsername}
            avatarUrl={friend.avatar || friend.requesterAvatar}
            avatarColor={friend.avatarColor || friend.requesterAvatarColor}
            avatarDecoration={friend.avatarDecoration || friend.requesterAvatarDecoration}
            size="medium"
            statusIndicator={
              !isRequest ? <UserAvatarPresenceDot status={friend.status} /> : null
            }
          />
        </div>

        <div className="friend-item__info">
          <div className="friend-item__name">
            {profileUsername}
          </div>
          {!isRequest && (
            <div className="friend-item__status">
              {normalizeUserStatus(friend.status) === PRESENCE_STATUS.OFFLINE && friend.lastSeen
                ? `Был в сети ${formatLastSeen(friend.lastSeen)}`
                : getUserStatusLabel(friend.status)}
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
          ) : isBlocked ? (
            <button
              className="friend-item__action-button friend-item__action-button--decline"
              onClick={() => onUnblock?.(friend.userId)}
              title="Разблокировать"
            >
              <Block />
            </button>
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
