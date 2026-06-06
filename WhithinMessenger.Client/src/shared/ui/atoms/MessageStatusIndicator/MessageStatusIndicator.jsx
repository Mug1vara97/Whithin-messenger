import React from 'react';
import { MessageStatus } from '../../../../entities/message/model/types';
import './MessageStatusIndicator.css';

const STATUS_LABELS = {
  [MessageStatus.SENDING]: 'Отправляется',
  [MessageStatus.SENT]: 'Отправлено',
  [MessageStatus.DELIVERED]: 'Доставлено',
  [MessageStatus.READ]: 'Прочитано',
  [MessageStatus.FAILED]: 'Ошибка отправки',
};

const MessageStatusIndicator = ({
  status = MessageStatus.SENT,
  onLightBubble = false,
}) => {
  const label = STATUS_LABELS[status] || STATUS_LABELS[MessageStatus.SENT];
  const lightClass = onLightBubble ? ' message-status--on-light' : '';

  if (status === MessageStatus.SENDING) {
    return (
      <span
        className={`message-status message-status--sending${lightClass}`}
        title={label}
        aria-label={label}
      >
        ◷
      </span>
    );
  }

  if (status === MessageStatus.FAILED) {
    return (
      <span
        className={`message-status message-status--failed${lightClass}`}
        title={label}
        aria-label={label}
      >
        !
      </span>
    );
  }

  if (status === MessageStatus.READ) {
    return (
      <span
        className={`message-status message-status--read${lightClass}`}
        title={label}
        aria-label={label}
      >
        ✓✓
      </span>
    );
  }

  if (status === MessageStatus.DELIVERED) {
    return (
      <span
        className={`message-status message-status--delivered${lightClass}`}
        title={label}
        aria-label={label}
      >
        ✓✓
      </span>
    );
  }

  return (
    <span
      className={`message-status message-status--sent${lightClass}`}
      title={label}
      aria-label={label}
    >
      ✓
    </span>
  );
};

export default MessageStatusIndicator;
