import React from 'react';
import NotificationsOutlinedIcon from '@mui/icons-material/NotificationsOutlined';
import CloseIcon from '@mui/icons-material/Close';
import TagIcon from '@mui/icons-material/Tag';
import PersonIcon from '@mui/icons-material/Person';
import GroupsIcon from '@mui/icons-material/Groups';
import {
  formatNotificationTime,
  getNotificationMessageText,
  getNotificationRowSubtitle,
  getNotificationRowTitle,
  normalizeNotification,
} from '../../../../entities/notification/lib/notificationDisplay';
import { UserAvatar } from '../../atoms';
import './NotificationsModal.css';

const NotificationRowIcon = ({ notification }) => {
  const item = normalizeNotification(notification);
  if (item.senderName) {
    return (
      <UserAvatar
        username={item.senderName}
        avatarUrl={item.senderAvatarUrl}
        avatarColor={item.senderAvatarColor}
        size={32}
        className="notifications-inbox__avatar"
      />
    );
  }
  if (item.serverId) {
    return (
      <span className="notifications-inbox__glyph" aria-hidden>
        <TagIcon sx={{ fontSize: 18 }} />
      </span>
    );
  }
  if (item.type === 'group_message' || item.type === 'GroupMessage') {
    return (
      <span className="notifications-inbox__glyph" aria-hidden>
        <GroupsIcon sx={{ fontSize: 18 }} />
      </span>
    );
  }
  return (
    <span className="notifications-inbox__glyph" aria-hidden>
      <PersonIcon sx={{ fontSize: 18 }} />
    </span>
  );
};

const NotificationsModal = ({
  isOpen,
  onClose,
  notifications = [],
  loading = false,
  error = null,
  unreadCount = 0,
  onOpenNotification,
  onDeleteNotification,
  onMarkAllAsRead,
  markingAllAsRead = false,
}) => {
  const handleOverlayClick = (event) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="notifications-inbox-overlay" onClick={handleOverlayClick} role="presentation">
      <div
        className="notifications-inbox"
        role="dialog"
        aria-modal="true"
        aria-labelledby="notifications-inbox-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="notifications-inbox__header">
          <div className="notifications-inbox__title-row">
            <NotificationsOutlinedIcon className="notifications-inbox__title-icon" sx={{ fontSize: 20 }} />
            <h2 id="notifications-inbox-title" className="notifications-inbox__title">
              Уведомления
            </h2>
          </div>
          {unreadCount > 0 && onMarkAllAsRead && (
            <button
              type="button"
              className="notifications-inbox__mark-all"
              onClick={onMarkAllAsRead}
              disabled={markingAllAsRead || loading}
            >
              {markingAllAsRead ? 'Читаем…' : 'Прочитать всё'}
            </button>
          )}
        </header>

        <div className="notifications-inbox__body">
          {loading ? (
            <div className="notifications-inbox__state">
              <div className="notifications-inbox__spinner" aria-hidden />
              <p>Загрузка...</p>
            </div>
          ) : error ? (
            <div className="notifications-inbox__state notifications-inbox__state--error">
              <p>{error}</p>
            </div>
          ) : notifications.length === 0 ? (
            <div className="notifications-inbox__state">
              <p>Нет уведомлений</p>
            </div>
          ) : (
            <ul className="notifications-inbox__list">
              {notifications.map((rawNotification) => {
                const notification = normalizeNotification(rawNotification);
                const title = getNotificationRowTitle(rawNotification);
                const subtitle = getNotificationRowSubtitle(rawNotification);
                const messageText = getNotificationMessageText(rawNotification);
                const timeLabel = formatNotificationTime(notification.createdAt);

                return (
                  <li key={notification.id} className="notifications-inbox__item">
                    <button
                      type="button"
                      className={`notifications-inbox__item-main${notification.isRead ? ' is-read' : ' is-unread'}`}
                      onClick={() => onOpenNotification?.(rawNotification)}
                    >
                      <NotificationRowIcon notification={rawNotification} />
                      <span className="notifications-inbox__item-content">
                        <span className="notifications-inbox__item-head">
                          <span className="notifications-inbox__item-title">{title}</span>
                          {timeLabel && (
                            <time className="notifications-inbox__item-time" dateTime={notification.createdAt}>
                              {timeLabel}
                            </time>
                          )}
                        </span>
                        {subtitle && (
                          <span className="notifications-inbox__item-subtitle">{subtitle}</span>
                        )}
                        {messageText && (
                          <span className="notifications-inbox__item-text">{messageText}</span>
                        )}
                      </span>
                    </button>
                    <button
                      type="button"
                      className="notifications-inbox__item-dismiss"
                      title="Убрать"
                      aria-label="Убрать уведомление"
                      onClick={(event) => {
                        event.stopPropagation();
                        event.preventDefault();
                        onDeleteNotification?.(event, rawNotification);
                      }}
                    >
                      <CloseIcon sx={{ fontSize: 16 }} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default NotificationsModal;
