import React, { useMemo } from 'react';
import CallMadeIcon from '@mui/icons-material/CallMade';
import CallMissedIcon from '@mui/icons-material/CallMissed';
import {
  buildCallLogText,
  parseCallLogPayload,
} from '../../../lib/utils/callLogHelpers';
import { formatDiscordMessageTimestamp } from '../../../lib/utils/messageTime';
import './CallLogMessage.css';

const GhostIcon = () => (
  <svg
    viewBox="0 0 512 512"
    className="call-log-message__ghost"
    aria-hidden="true"
    focusable="false"
  >
    <path d="M168.1 531.1L156.9 540.1C153.7 542.6 149.8 544 145.8 544C136 544 128 536 128 526.2L128 256C128 150 214 64 320 64C426 64 512 150 512 256L512 526.2C512 536 504 544 494.2 544C490.2 544 486.3 542.6 483.1 540.1L471.9 531.1C458.5 520.4 439.1 522.1 427.8 535L397.3 570C394 573.8 389.1 576 384 576C378.9 576 374.1 573.8 370.7 570L344.1 539.5C331.4 524.9 308.7 524.9 295.9 539.5L269.3 570C266 573.8 261.1 576 256 576C250.9 576 246.1 573.8 242.7 570L212.2 535C200.9 522.1 181.5 520.4 168.1 531.1zM288 256C288 238.3 273.7 224 256 224C238.3 224 224 238.3 224 256C224 273.7 238.3 288 256 288C273.7 288 288 273.7 288 256zM384 288C401.7 288 416 273.7 416 256C416 238.3 401.7 224 384 224C366.3 224 352 238.3 352 256C352 273.7 366.3 288 384 288z" />
  </svg>
);

const CallLogMessage = ({ message, currentUserId }) => {
  const payload = useMemo(() => parseCallLogPayload(message?.content), [message?.content]);
  const text = useMemo(
    () => buildCallLogText(payload, currentUserId),
    [payload, currentUserId],
  );

  if (!text) {
    return null;
  }

  const isMissed = payload?.callEvent === 'missed';
  const callerName = payload?.callerName || 'Пользователь';
  const isCaller = String(payload?.callerId || '') === String(currentUserId || '');
  const highlightName = !isMissed && !isCaller ? callerName : null;

  const renderText = () => {
    if (!highlightName || !text.includes(callerName)) {
      return text;
    }

    const [before, after] = text.split(callerName);
    return (
      <>
        {before}
        <strong>{callerName}</strong>
        {after}
      </>
    );
  };

  return (
    <div className="call-log-message" role="status">
      <span className="call-log-message__avatar" aria-hidden="true">
        <GhostIcon />
      </span>
      <span className={`call-log-message__status-icon${isMissed ? ' call-log-message__status-icon--missed' : ''}`} aria-hidden="true">
        {isMissed ? <CallMissedIcon fontSize="inherit" /> : <CallMadeIcon fontSize="inherit" />}
      </span>
      <span className="call-log-message__text">{renderText()}</span>
      <span className="call-log-message__time">{formatDiscordMessageTimestamp(message.createdAt)}</span>
    </div>
  );
};

export default CallLogMessage;
