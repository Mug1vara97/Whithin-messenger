import React from 'react';
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

  return (
    <div 
      className={`server-icon ${isActive ? 'active' : ''}`}
      style={{ width: size, height: size }}
      onClick={handleClick}
    >
      {server?.avatar ? (
        <img 
          src={server.avatar} 
          alt={server.name}
          className="server-avatar-image"
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
