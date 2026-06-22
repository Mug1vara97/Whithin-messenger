import React from 'react';
import NotificationsIcon from '@mui/icons-material/Notifications';
import NotificationsOffIcon from '@mui/icons-material/NotificationsOff';
import './NotificationBellButton.css';

const NotificationBellButton = ({
  unreadCount = 0,
  isOpen = false,
  onClick,
  className = '',
  variant = 'titlebar',
  iconSize = 18,
  title = 'Уведомления',
}) => {
  const hasUnread = unreadCount > 0;

  return (
    <button
      type="button"
      className={[
        'notification-bell-btn',
        `notification-bell-btn--${variant}`,
        isOpen ? 'is-open' : '',
        hasUnread ? 'has-unread' : '',
        className,
      ].filter(Boolean).join(' ')}
      onClick={onClick}
      title={title}
      aria-label={hasUnread ? `${title}, есть непрочитанные` : title}
      aria-pressed={isOpen}
    >
      {hasUnread ? (
        <NotificationsIcon sx={{ fontSize: iconSize }} />
      ) : (
        <NotificationsOffIcon sx={{ fontSize: iconSize }} />
      )}
      {hasUnread && <span className="notification-bell-btn__dot" aria-hidden />}
    </button>
  );
};

export default NotificationBellButton;
