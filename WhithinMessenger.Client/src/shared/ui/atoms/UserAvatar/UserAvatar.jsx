import React, { useState } from 'react';
import { BASE_URL } from '../../../lib/constants/apiEndpoints';
import './UserAvatar.css';

const UserAvatar = ({ username, avatarUrl, avatarColor, size = 40, onClick, className = '' }) => {
  const [imageError, setImageError] = useState(false);
  
  // Обработка размеров
  const getSize = (size) => {
    switch (size) {
      case 'small':
        return 24;
      case 'medium':
        return 40;
      case 'large':
        return 64;
      default:
        return typeof size === 'number' ? size : 40;
    }
  };
  
  const avatarSize = getSize(size);
  const displayInitials = !avatarUrl || imageError;
  const isClickable = Boolean(onClick);

  const content = !displayInitials ? (
    <img
      src={avatarUrl.startsWith('http') ? avatarUrl : `${BASE_URL}${avatarUrl}`}
      alt=""
      onError={() => setImageError(true)}
      style={{
        width: '100%',
        height: '100%',
        borderRadius: '50%',
        objectFit: 'cover',
      }}
    />
  ) : (
    username?.charAt(0).toUpperCase() || '?'
  );

  return (
    <div
      className={`user-avatar ${isClickable ? 'user-avatar--clickable' : ''} ${className}`.trim()}
      style={{
        backgroundColor: avatarColor || '#5865F2',
        width: `${avatarSize}px`,
        height: `${avatarSize}px`,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        fontSize: `${Math.max(12, avatarSize * 0.35)}px`,
        fontWeight: 'bold',
        flexShrink: 0,
        overflow: 'hidden',
      }}
      onClick={onClick}
      onKeyDown={
        isClickable
          ? (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onClick?.(event);
              }
            }
          : undefined
      }
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
    >
      {content}
    </div>
  );
};

export default UserAvatar;