import React from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  MotionAlert,
  MotionAlertClose,
  MotionAlertContent,
  MotionAlertDescription,
  MotionAlertTitle,
} from '../../molecules/MotionAlert';
import UserAvatar from '../../atoms/UserAvatar';
import { hasElectronTitlebarChrome } from '../../molecules/ElectronTitlebar';
import './InAppNotificationStack.css';

const EASE_OUT = [0.16, 1, 0.3, 1];

const InAppNotificationStack = ({
  items = [],
  position = 'top-right',
  onDismiss,
  onDismissAll,
  onOpen,
}) => {
  const reduce = useReducedMotion() ?? false;
  if (items.length === 0) return null;

  const positionClass = `in-app-notifications--${position}`;
  const withTitlebarClass = hasElectronTitlebarChrome() ? 'in-app-notifications--with-titlebar' : '';

  return (
    <div
      className={`in-app-notifications ${positionClass} ${withTitlebarClass}`.trim()}
      aria-live="polite"
    >
      <button
        type="button"
        className="in-app-notifications__hide-all"
        onClick={onDismissAll}
      >
        Скрыть все
      </button>

      <div className="in-app-notifications__list">
        <AnimatePresence initial={false}>
          {items.map((item) => (
            <motion.div
              key={item.id}
              layout={!reduce}
              initial={{ opacity: 0, y: reduce ? 0 : -8, scale: reduce ? 1 : 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{
                opacity: 0,
                y: reduce ? 0 : -6,
                transition: { duration: 0.14, ease: EASE_OUT },
              }}
              transition={{ duration: 0.2, ease: EASE_OUT }}
            >
              <MotionAlert
                variant="info"
                open
                presence={false}
                className="in-app-notification-alert"
                onOpenChange={(open) => {
                  if (!open) onDismiss?.(item.id);
                }}
              >
                <button
                  type="button"
                  className="in-app-notification-alert__hit"
                  onClick={() => onOpen?.(item)}
                  aria-label={`Открыть: ${item.title || 'уведомление'}`}
                >
                  <span className="in-app-notification-alert__avatar" aria-hidden>
                    <UserAvatar
                      username={item.senderName || item.title}
                      avatarUrl={item.senderAvatarUrl}
                      avatarColor={item.senderAvatarColor}
                      size={36}
                    />
                  </span>
                  <MotionAlertContent>
                    <MotionAlertTitle>{item.title}</MotionAlertTitle>
                    {item.subtitle ? (
                      <div className="in-app-notification-alert__subtitle">{item.subtitle}</div>
                    ) : null}
                    <MotionAlertDescription>{item.message}</MotionAlertDescription>
                  </MotionAlertContent>
                </button>
                <MotionAlertClose />
              </MotionAlert>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default InAppNotificationStack;
