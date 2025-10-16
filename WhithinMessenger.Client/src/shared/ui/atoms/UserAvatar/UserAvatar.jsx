import React from 'react';
import { BASE_URL } from '../../../lib/constants/apiEndpoints';
import './UserAvatar.css';

const UserAvatar = ({ username, avatarUrl, avatarColor, size = 40 }) => {
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
  return (
    <div 
      className="user-avatar"
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
        flexShrink: 0
      }}
    >
      {avatarUrl ? (
        <img 
          src={avatarUrl.startsWith('http') ? avatarUrl : `${BASE_URL}${avatarUrl}`} 
          alt="User avatar" 
          style={{
            width: '100%',
            height: '100%',
            borderRadius: '50%',
            objectFit: 'cover'
          }}
        />
      ) : (
        username?.charAt(0).toUpperCase()
      )}
    </div>
  );
};

export default UserAvatar;