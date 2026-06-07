import React from 'react';
import DoneIcon from '@mui/icons-material/Done';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import ScheduleIcon from '@mui/icons-material/Schedule';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { MessageStatus } from '../../../../entities/message/model/types';
import './MessageStatusIndicator.css';

const STATUS_LABELS = {
  [MessageStatus.SENDING]: 'Отправляется',
  [MessageStatus.SENT]: 'Отправлено',
  [MessageStatus.DELIVERED]: 'Доставлено',
  [MessageStatus.READ]: 'Прочитано',
  [MessageStatus.FAILED]: 'Ошибка отправки',
};

const SENT_COLOR = 'rgba(255, 255, 255, 0.55)';
const DELIVERED_COLOR = 'rgba(255, 255, 255, 0.7)';
const READ_COLOR = '#8be9ff';
const SENDING_COLOR = 'rgba(255, 255, 255, 0.45)';
const FAILED_COLOR = '#ed4245';
const ON_LIGHT_MUTED = '#949ba4';
const ON_LIGHT_READ = 'var(--primary, #5865f2)';

const MessageStatusIndicator = ({
  status = MessageStatus.SENT,
  onLightBubble = false,
}) => {
  const label = STATUS_LABELS[status] || STATUS_LABELS[MessageStatus.SENT];
  const lightClass = onLightBubble ? ' message-status--on-light' : '';

  const iconSx = (color) => ({
    fontSize: onLightBubble ? 14 : 15,
    color,
  });

  if (status === MessageStatus.SENDING) {
    return (
      <ScheduleIcon
        className={`message-status message-status--sending${lightClass}`}
        titleAccess={label}
        aria-label={label}
        sx={iconSx(onLightBubble ? ON_LIGHT_MUTED : SENDING_COLOR)}
      />
    );
  }

  if (status === MessageStatus.FAILED) {
    return (
      <ErrorOutlineIcon
        className={`message-status message-status--failed${lightClass}`}
        titleAccess={label}
        aria-label={label}
        sx={iconSx(FAILED_COLOR)}
      />
    );
  }

  if (status === MessageStatus.READ) {
    return (
      <DoneAllIcon
        className={`message-status message-status--read${lightClass}`}
        titleAccess={label}
        aria-label={label}
        sx={iconSx(onLightBubble ? ON_LIGHT_READ : READ_COLOR)}
      />
    );
  }

  if (status === MessageStatus.DELIVERED) {
    return (
      <DoneAllIcon
        className={`message-status message-status--delivered${lightClass}`}
        titleAccess={label}
        aria-label={label}
        sx={iconSx(onLightBubble ? ON_LIGHT_MUTED : DELIVERED_COLOR)}
      />
    );
  }

  return (
    <DoneIcon
      className={`message-status message-status--sent${lightClass}`}
      titleAccess={label}
      aria-label={label}
      sx={iconSx(onLightBubble ? ON_LIGHT_MUTED : SENT_COLOR)}
    />
  );
};

export default MessageStatusIndicator;
