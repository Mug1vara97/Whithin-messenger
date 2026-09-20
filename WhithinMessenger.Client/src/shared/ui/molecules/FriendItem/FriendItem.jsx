import React, { useState } from 'react';
import { PersonOff, MoreVert, Check, Close, Block, ChatBubbleOutline } from '@mui/icons-material';
import UserAvatar from '../../atoms/UserAvatar';
import { UserAvatarPresenceDot } from '../../atoms/UserAvatar';
import { useProfileModal } from '../../../lib/contexts/ProfileModalContext';
import { usePresence, useResolvedPresence } from '../../../lib/contexts/PresenceContext';
import { PRESENCE_STATUS } from '../../../lib/utils/userStatus';
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
  const { getLastSeen } = usePresence();

  const profileUserId = friend.userId || friend.requesterUserId;
  const profileUsername = friend.username || friend.requesterUsername;
  const presence = useResolvedPresence(profileUserId, friend.status);
  const lastSeen = getLastSeen(profileUserId, friend.lastSeen);

  const handleOpenProfile = () => {
    if (!profileUserId) return;
    openProfile(profileUserId, profileUsername, presence.normalized);
  };

  const formatLastSeen = (value) => {
    if (!value) return '';

    const date = new Date(value);
    const now = new Date();
    const diffInHours = (now - date) / (1000 * 60 * 60);

    if (diffInHours < 1) {
      return 'только что';
    }
    if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}ч назад`;
    }
    return date.toLocaleDateString();
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
              !isRequest ? <UserAvatarPresenceDot status={presence.normalized} /> : null
            }
          />
        </div>

        <div className="friend-item__info">
          <div className="friend-item__name">{profileUsername}</div>
          {!isRequest && (
            <div className="friend-item__status">
              {presence.normalized === PRESENCE_STATUS.OFFLINE && lastSeen
                ? `Был в сети ${formatLastSeen(lastSeen)}`
                : presence.label}
            </div>
          )}
          {isRequest && <div className="friend-item__request-info">Запрос в друзья</div>}
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
                type="button"
              >
                <Check />
              </button>
              <button
                className="friend-item__action-button friend-item__action-button--decline"
                onClick={() => onDecline?.(friend.id)}
                title="Отклонить"
                type="button"
              >
                <Close />
              </button>
            </>
          ) : isBlocked ? (
            <button
              className="friend-item__action-button friend-item__action-button--decline"
              onClick={() => onUnblock?.(friend.userId)}
              title="Разблокировать"
              type="button"
            >
              <Block />
            </button>
          ) : (
            <>
              <button
                className="friend-item__action-button friend-item__action-button--message"
                onClick={() => onStartChat?.(friend.userId)}
                title="Написать сообщение"
                type="button"
              >
                <ChatBubbleOutline />
              </button>
              <button
                className="friend-item__action-button friend-item__action-button--more"
                onClick={() => setShowContextMenu(!showContextMenu)}
                title="Еще"
                type="button"
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
            type="button"
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
