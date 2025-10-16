import React from 'react';
import { Check, Close, Person } from '@mui/icons-material';
import UserAvatar from '../../atoms/UserAvatar';
import { Button } from '../../atoms/Button';
import './FriendRequestItem.css';

const FriendRequestItem = ({ 
  request, 
  onAccept, 
  onDecline,
  isSent = false 
}) => {
  const formatDate = (date) => {
    const requestDate = new Date(date);
    const now = new Date();
    const diffInHours = (now - requestDate) / (1000 * 60 * 60);
    
    if (diffInHours < 1) {
      return 'только что';
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}ч назад`;
    } else {
      return requestDate.toLocaleDateString();
    }
  };

  return (
    <div className="friend-request-item">
      <div className="friend-request-item__avatar">
        <UserAvatar
          username={request.requesterUsername}
          avatar={request.requesterAvatar}
          avatarColor={request.requesterAvatarColor}
          size="medium"
        />
      </div>
      
      <div className="friend-request-item__info">
        <div className="friend-request-item__name">
          {request.requesterUsername}
        </div>
        <div className="friend-request-item__time">
          {isSent ? 'Отправлен' : 'Получен'} {formatDate(request.createdAt)}
        </div>
      </div>
      
      {!isSent && (
        <div className="friend-request-item__actions">
          <Button
            variant="primary"
            size="small"
            onClick={() => onAccept?.(request.id)}
            icon={<Check />}
          >
            Принять
          </Button>
          <Button
            variant="secondary"
            size="small"
            onClick={() => onDecline?.(request.id)}
            icon={<Close />}
          >
            Отклонить
          </Button>
        </div>
      )}
      
      {isSent && (
        <div className="friend-request-item__status">
          <Person className="friend-request-item__status-icon" />
          <span>Ожидает ответа</span>
        </div>
      )}
    </div>
  );
};

export default FriendRequestItem;
