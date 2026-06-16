export const CALL_RING_TIMEOUT_MS = 180_000;

export function parseCallLogPayload(content) {
  if (!content || typeof content !== 'string') {
    return null;
  }

  try {
    const parsed = JSON.parse(content);
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function formatCallDuration(seconds) {
  const total = Math.max(0, Number(seconds) || 0);
  if (total < 60) {
    return total <= 5 ? 'несколько секунд' : `${total} сек.`;
  }

  const minutes = Math.floor(total / 60);
  const remainder = total % 60;
  if (remainder === 0) {
    return `${minutes} ${pluralizeMinutes(minutes)}`;
  }
  return `${minutes} ${pluralizeMinutes(minutes)} ${remainder} сек.`;
}

function pluralizeMinutes(count) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return 'минуту';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'минуты';
  return 'минут';
}

export function buildCallLogText(payload, currentUserId) {
  if (!payload?.callEvent) {
    return null;
  }

  const callerId = String(payload.callerId || '');
  const callerName = payload.callerName || 'Пользователь';
  const duration = formatCallDuration(payload.durationSeconds);
  const isCaller = callerId && currentUserId && String(currentUserId) === callerId;

  if (payload.callEvent === 'missed') {
    if (isCaller) {
      return `Собеседник пропустил ваш звонок, который длился ${duration}.`;
    }
    return `Вы пропустили звонок от ${callerName}, который длился ${duration}.`;
  }

  if (payload.callEvent === 'completed') {
    if (isCaller) {
      return `Вы начали звонок, который продлился ${duration}.`;
    }
    return `${callerName} начал звонок, который продлился ${duration}.`;
  }

  return null;
}

export function isCallLogMessage(message) {
  const type = message?.contentType || message?.ContentType;
  if (type === 'call_log') {
    return true;
  }
  return Boolean(parseCallLogPayload(message?.content));
}
