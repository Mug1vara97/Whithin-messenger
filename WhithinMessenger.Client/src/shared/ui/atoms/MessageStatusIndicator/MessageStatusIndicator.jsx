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

const MessageStatusIndicator = ({ status = MessageStatus.SENT }) => {
  const label = STATUS_LABELS[status] || STATUS_LABELS[MessageStatus.SENT];

  if (status === MessageStatus.SENDING) {
    return (
      <span className="message-status message-status--sending" title={label} aria-label={label}>
        ◷
      </span>
    );
  }

  if (status === MessageStatus.FAILED) {
    return (
      <span className="message-status message-status--failed" title={label} aria-label={label}>
        !
      </span>
    );
  }

  if (status === MessageStatus.READ) {
    return (
      <span className="message-status message-status--read" title={label} aria-label={label}>
        ✓✓
      </span>
    );
  }

  if (status === MessageStatus.DELIVERED) {
    return (
      <span className="message-status message-status--delivered" title={label} aria-label={label}>
        ✓✓
      </span>
    );
  }

  return (
    <span className="message-status message-status--sent" title={label} aria-label={label}>
      ✓
    </span>
  );
};

export default MessageStatusIndicator;
