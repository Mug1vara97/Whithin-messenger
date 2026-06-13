const pad = (value) => String(value).padStart(2, '0');

const toDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const isSameDay = (a, b) => (
  a.getFullYear() === b.getFullYear()
  && a.getMonth() === b.getMonth()
  && a.getDate() === b.getDate()
);

export function formatChatListMessageTime(value) {
  const date = toDate(value);
  if (!date) return null;

  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  if (isSameDay(date, now)) {
    return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  if (isSameDay(date, yesterday)) {
    return 'Вчера';
  }

  const day = pad(date.getDate());
  const month = pad(date.getMonth() + 1);

  if (date.getFullYear() === now.getFullYear()) {
    return `${day}.${month}`;
  }

  const year = String(date.getFullYear()).slice(-2);
  return `${day}.${month}.${year}`;
}
