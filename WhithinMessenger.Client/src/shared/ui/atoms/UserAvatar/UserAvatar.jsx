import React, { useState } from 'react';
import { BASE_URL } from '../../../lib/constants/apiEndpoints';
import { resolveAvatarDecorationUrl } from '../../../lib/utils/avatarDecorationHelpers';
import AvatarDecorationMedia from './AvatarDecorationMedia';
import './UserAvatar.css';

const UserAvatar = ({
  username,
  avatarUrl,
  avatarColor,
  avatarDecoration,
  size = 40,
  onClick,
  className = '',
  statusIndicator = null,
  statusIndicatorInteractive = false,
}) => {
  const [imageError, setImageError] = useState(false);

  const getSize = (value) => {
    switch (value) {
      case 'small':
        return 24;
      case 'medium':
        return 40;
      case 'large':
        return 64;
      default:
        return typeof value === 'number' ? value : 40;
    }
  };

  const avatarSize = getSize(size);
  const displayInitials = !avatarUrl || imageError;
  const isClickable = Boolean(onClick);
  const decorationUrl = resolveAvatarDecorationUrl(avatarDecoration);
  const hasDecoration = Boolean(decorationUrl);

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
      className={`user-avatar-frame ${hasDecoration ? 'user-avatar-frame--decorated' : ''} ${className}`.trim()}
      style={{
        width: `${avatarSize}px`,
        height: `${avatarSize}px`,
      }}
    >
      <div className="user-avatar-core">
        <div
          className={`user-avatar ${isClickable ? 'user-avatar--clickable' : ''}`.trim()}
          style={{
            backgroundColor: avatarColor || '#5865F2',
            fontSize: `${Math.max(12, avatarSize * 0.35)}px`,
            fontWeight: 'bold',
            color: 'white',
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
      </div>
      {hasDecoration && (
        <div className="user-avatar-decoration-layer" aria-hidden="true">
          <AvatarDecorationMedia src={decorationUrl} />
        </div>
      )}
      {statusIndicator && (
        <div className="user-avatar-status-anchor">
          <div
            className={`user-avatar-status-indicator${statusIndicatorInteractive ? ' user-avatar-status-indicator--interactive' : ''}`.trim()}
          >
            {statusIndicator}
          </div>
        </div>
      )}
    </div>
  );
};

export default UserAvatar;
