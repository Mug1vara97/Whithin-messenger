import React from 'react';
import { BASE_URL } from '../../../lib/constants/apiEndpoints';
import './ServerIcon.css';

const ServerIcon = ({ 
  server, 
  size = '48px', 
  isActive = false,
  onClick 
}) => {
  const getServerInitials = (name) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const handleClick = () => {
    if (onClick) {
      onClick(server);
    }
  };

  const getAvatarUrl = () => {
    if (!server?.avatar) return null;
    // Если уже полный URL, возвращаем как есть
    if (server.avatar.startsWith('http://') || server.avatar.startsWith('https://')) {
      return server.avatar;
    }
    // Иначе добавляем BASE_URL
    return `${BASE_URL}${server.avatar.startsWith('/') ? server.avatar : '/' + server.avatar}`;
  };

  return (
    <div 
      className={`server-icon ${isActive ? 'active' : ''}`}
      style={{ width: size, height: size }}
      onClick={handleClick}
    >
      {getAvatarUrl() ? (
        <img 
          src={getAvatarUrl()} 
          alt={server?.name || 'Server'}
          className="server-avatar-image"
          onError={(e) => {
            // Если изображение не загрузилось, скрываем его и показываем инициалы
            e.target.style.display = 'none';
            const parent = e.target.parentElement;
            if (parent && !parent.querySelector('.server-initials')) {
              const initials = document.createElement('div');
              initials.className = 'server-initials';
              initials.textContent = getServerInitials(server?.name);
              parent.appendChild(initials);
            }
          }}
        />
      ) : (
        <div className="server-initials">
          {getServerInitials(server?.name)}
        </div>
      )}
    </div>
  );
};

export default ServerIcon;
