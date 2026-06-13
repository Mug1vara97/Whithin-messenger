export const getPinnedMessagePreview = (pinned) => {
  if (!pinned) return 'Сообщение';

  if (pinned.contentType === 'poll') {
    return pinned.poll?.question || pinned.content || 'Опрос';
  }

  if (pinned.contentType === 'sticker') {
    return 'Стикер';
  }

  const text = pinned.content?.trim();
  if (text) {
    return text.replace(/\s+/g, ' ');
  }

  const media = pinned.mediaFiles?.[0];
  if (media) {
    if (media.isVideoNote) return 'Видеосообщение';
    if (media.contentType?.startsWith('image/')) return 'Фото';
    if (media.contentType?.startsWith('video/')) return 'Видео';
    if (media.contentType?.startsWith('audio/')) return 'Голосовое сообщение';
    return 'Вложение';
  }

  return 'Сообщение';
};
