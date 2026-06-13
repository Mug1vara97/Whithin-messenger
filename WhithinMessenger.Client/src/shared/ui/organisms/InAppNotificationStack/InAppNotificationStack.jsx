import React from 'react';
import CloseIcon from '@mui/icons-material/Close';
import UserAvatar from '../../atoms/UserAvatar';
import './InAppNotificationStack.css';

const InAppNotificationStack = ({
  items = [],
  position = 'top-right',
  onDismiss,
  onDismissAll,
  onOpen,
}) => {
  if (items.length === 0) return null;

  const positionClass = `in-app-notifications--${position}`;

  return (
    <div className={`in-app-notifications ${positionClass}`} aria-live="polite">
      <button
        type="button"
        className="in-app-notifications__hide-all"
        onClick={onDismissAll}
      >
        Скрыть все
      </button>

      <div className="in-app-notifications__list">
        {items.map((item) => (
          <article
            key={item.id}
            className="in-app-notification-card"
            onClick={() => onOpen?.(item)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onOpen?.(item);
              }
            }}
            role="button"
            tabIndex={0}
          >
            <button
              type="button"
              className="in-app-notification-card__close"
              aria-label="Закрыть уведомление"
              onClick={(event) => {
                event.stopPropagation();
                onDismiss?.(item.id);
              }}
            >
              <CloseIcon sx={{ fontSize: 16 }} />
            </button>

            <div className="in-app-notification-card__avatar">
              <UserAvatar
                username={item.senderName || item.title}
                avatarUrl={item.senderAvatarUrl}
                avatarColor={item.senderAvatarColor}
                size={42}
              />
            </div>

            <div className="in-app-notification-card__body">
              <div className="in-app-notification-card__title">{item.title}</div>
              {item.subtitle ? (
                <div className="in-app-notification-card__subtitle">{item.subtitle}</div>
              ) : null}
              <div className="in-app-notification-card__message">{item.message}</div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
};

export default InAppNotificationStack;
