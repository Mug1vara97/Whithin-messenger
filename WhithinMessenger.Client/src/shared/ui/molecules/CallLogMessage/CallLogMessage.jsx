import React, { useMemo } from 'react';
import CallMadeIcon from '@mui/icons-material/CallMade';
import CallMissedIcon from '@mui/icons-material/CallMissed';
import {
  buildCallLogText,
  parseCallLogPayload,
} from '../../../lib/utils/callLogHelpers';
import { formatDiscordMessageTimestamp } from '../../../lib/utils/messageTime';
import './CallLogMessage.css';

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
      <span className={`call-log-message__icon${isMissed ? ' call-log-message__icon--missed' : ''}`} aria-hidden="true">
        {isMissed ? <CallMissedIcon fontSize="inherit" /> : <CallMadeIcon fontSize="inherit" />}
      </span>
      <span className="call-log-message__text">{renderText()}</span>
      <span className="call-log-message__time">{formatDiscordMessageTimestamp(message.createdAt)}</span>
    </div>
  );
};

export default CallLogMessage;
