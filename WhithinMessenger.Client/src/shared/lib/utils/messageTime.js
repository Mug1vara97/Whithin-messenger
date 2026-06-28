export const formatShortMessageTime = (dateString) => {
  if (!dateString) return '';

  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return '';

  const pad = (value) => String(value).padStart(2, '0');
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

export const formatDiscordMessageTimestamp = (dateString) => {
  if (!dateString) return '';

  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return '';

  const pad = (value) => String(value).padStart(2, '0');

  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const startOfLocalDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

export const getMessageLocalDateKey = (dateString) => {
  if (!dateString) return null;
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return null;
  const day = startOfLocalDay(date);
  return `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`;
};

/** Date chip label in chat timeline — matches Android (Сегодня / Вчера / d MMM). */
export const formatMessageDateChip = (dateString) => {
  if (!dateString) return '';

  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return '';

  const today = startOfLocalDay(new Date());
  const messageDay = startOfLocalDay(date);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (messageDay.getTime() === today.getTime()) return 'Сегодня';
  if (messageDay.getTime() === yesterday.getTime()) return 'Вчера';

  return date.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
  }).replace('.', '');
};

export const buildMessagesWithDateSeparators = (messages) => {
  if (!Array.isArray(messages) || messages.length === 0) return [];

  const items = [];
  let previousDateKey = null;

  messages.forEach((message) => {
    const dateKey = getMessageLocalDateKey(message.createdAt);
    if (dateKey && dateKey !== previousDateKey) {
      items.push({
        type: 'date',
        key: `date-${dateKey}`,
        label: formatMessageDateChip(message.createdAt),
      });
      previousDateKey = dateKey;
    }
    items.push({
      type: 'message',
      key: String(message.messageId),
      message,
    });
  });

  return items;
};
