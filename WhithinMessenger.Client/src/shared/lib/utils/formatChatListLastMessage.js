const ATTACHMENT_EXTENSIONS = /\.(jpg|jpeg|png|gif|webp|mp4|webm|ogg|mp3|wav|pdf)$/i;

export function formatChatListLastMessage(raw) {
  const text = (raw ?? '').trim();
  if (!text) return null;

  const lower = text.toLowerCase();

  if (
    lower.startsWith('/uploads/')
    || lower.includes('whithin.ru/uploads')
    || ATTACHMENT_EXTENSIONS.test(lower)
  ) {
    return 'Вложение';
  }

  if (
    (text.startsWith('http://') || text.startsWith('https://'))
    && !text.includes(' ')
  ) {
    return 'Ссылка';
  }

  return text.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160);
}
