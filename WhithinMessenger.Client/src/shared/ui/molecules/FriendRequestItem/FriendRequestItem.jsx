import React from 'react';
import { Check, Close, HourglassEmpty } from '@mui/icons-material';
import UserAvatar from '../../atoms/UserAvatar';
import './FriendRequestItem.css';

const FriendRequestItem = ({
  request,
  onAccept,
  onDecline,
  isSent = false,
}) => {
  const formatDate = (date) => {
    if (!date) return '';

    const requestDate = new Date(date);
    if (Number.isNaN(requestDate.getTime())) return '';

    const now = new Date();
    const diffInHours = (now - requestDate) / (1000 * 60 * 60);

    if (diffInHours < 1) {
      return 'только что';
    }
    if (diffInHours < 24) {
      return `${Math.floor(diffInHours)} ч. назад`;
    }
    return requestDate.toLocaleDateString('ru-RU');
  };

  return (
    <div className="friend-request-item">
      <div className="friend-request-item__avatar">
        <UserAvatar
          username={request.requesterUsername}
          avatarUrl={request.requesterAvatar}
          avatarColor={request.requesterAvatarColor}
          size="medium"
        />
      </div>

      <div className="friend-request-item__info">
        <div className="friend-request-item__name">{request.requesterUsername}</div>
        <div className="friend-request-item__time">
          {isSent ? 'Отправлен' : 'Получен'} · {formatDate(request.createdAt)}
        </div>
      </div>

      {!isSent ? (
        <div className="friend-request-item__actions">
          <button
            type="button"
            className="friend-request-item__action friend-request-item__action--accept"
            onClick={() => onAccept?.(request.id)}
            title="Принять"
          >
            <Check />
          </button>
          <button
            type="button"
            className="friend-request-item__action friend-request-item__action--decline"
            onClick={() => onDecline?.(request.id)}
            title="Отклонить"
          >
            <Close />
          </button>
        </div>
      ) : (
        <div className="friend-request-item__status">
          <HourglassEmpty sx={{ fontSize: 16 }} />
          <span>Ожидает</span>
        </div>
      )}
    </div>
  );
};

export default FriendRequestItem;
