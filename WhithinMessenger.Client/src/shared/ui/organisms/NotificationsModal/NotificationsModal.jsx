import React, { useEffect } from 'react';
import TagIcon from '@mui/icons-material/Tag';
import PersonIcon from '@mui/icons-material/Person';
import GroupsIcon from '@mui/icons-material/Groups';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import {
  formatNotificationTime,
  getNotificationLocation,
  getNotificationMessageText,
  getNotificationSenderLine,
  getNotificationTypeLabel,
  normalizeNotification,
} from '../../../../entities/notification/lib/notificationDisplay';
import './NotificationsModal.css';

const formatUnreadCountLabel = (count) => {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return `${count} непрочитанное`;
  return `${count} непрочитанных`;
};

const NotificationIcon = ({ type, serverId }) => {
  if (serverId) {
    return <TagIcon sx={{ fontSize: 18 }} />;
  }
  if (type === 'group_message') {
    return <GroupsIcon sx={{ fontSize: 18 }} />;
  }
  return <PersonIcon sx={{ fontSize: 18 }} />;
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
}) => {
  useEffect(() => {
    if (!isOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleOverlayClick = (event) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="notifications-modal-overlay" onClick={handleOverlayClick} role="presentation">
      <div
        className="notifications-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="notifications-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="notifications-modal__header">
          <div className="notifications-modal__title-block">
            <h2 id="notifications-modal-title" className="notifications-modal__title">
              Уведомления
            </h2>
            {unreadCount > 0 && (
              <p className="notifications-modal__subtitle">{formatUnreadCountLabel(unreadCount)}</p>
            )}
          </div>
          <button
            type="button"
            className="notifications-modal__close"
            onClick={onClose}
            aria-label="Закрыть"
          >
            ×
          </button>
        </header>

        <div className="notifications-modal__body">
          {loading ? (
            <div className="notifications-modal__state">
              <div className="notifications-modal__spinner" aria-hidden />
              <p>Загрузка уведомлений...</p>
            </div>
          ) : error ? (
            <div className="notifications-modal__state notifications-modal__state--error">
              <p>{error}</p>
            </div>
          ) : notifications.length === 0 ? (
            <div className="notifications-modal__state">
              <p className="notifications-modal__empty-title">Нет новых уведомлений</p>
              <p className="notifications-modal__empty-text">
                Здесь появятся сообщения из личных чатов, групп и серверов
              </p>
            </div>
          ) : (
            <ul className="notifications-modal__list">
              {notifications.map((rawNotification) => {
                const notification = normalizeNotification(rawNotification);
                const typeLabel = getNotificationTypeLabel(notification.type, notification.serverId);
                const location = getNotificationLocation(notification);
                const senderLine = getNotificationSenderLine(rawNotification);
                const messageText = getNotificationMessageText(rawNotification);
                const timeLabel = formatNotificationTime(notification.createdAt);

                return (
                  <li key={notification.id}>
                    <button
                      type="button"
                      className={`notifications-modal__item ${notification.isRead ? 'is-read' : 'is-unread'}`}
                      onClick={() => onOpenNotification?.(rawNotification)}
                    >
                      <span className="notifications-modal__item-icon" aria-hidden>
                        <NotificationIcon type={notification.type} serverId={notification.serverId} />
                      </span>

                      <span className="notifications-modal__item-content">
                        <span className="notifications-modal__item-top">
                          <span className="notifications-modal__item-type">{typeLabel}</span>
                          {timeLabel && (
                            <time className="notifications-modal__item-time" dateTime={notification.createdAt}>
                              {timeLabel}
                            </time>
                          )}
                        </span>

                        {location && (
                          <span className="notifications-modal__item-location">{location}</span>
                        )}

                        {senderLine && (
                          <span className="notifications-modal__item-sender">{senderLine}</span>
                        )}

                        <span className="notifications-modal__item-text">{messageText}</span>
                      </span>

                      <span
                        className="notifications-modal__item-delete"
                        role="button"
                        tabIndex={0}
                        title="Удалить уведомление"
                        aria-label="Удалить уведомление"
                        onClick={(event) => onDeleteNotification?.(event, rawNotification)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            onDeleteNotification?.(event, rawNotification);
                          }
                        }}
                      >
                        <DeleteOutlineIcon sx={{ fontSize: 18 }} />
                      </span>
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
