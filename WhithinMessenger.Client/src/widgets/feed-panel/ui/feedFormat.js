import { formatFeedTime } from '../../../entities/feed';

export const formatFileSize = (bytes) => {
  const size = Number(bytes) || 0;
  if (size < 1024) return `${size} Б`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} КБ`;
  return `${(size / (1024 * 1024)).toFixed(1)} МБ`;
};

export const formatScore = (likes, dislikes) => {
  const score = Number(likes || 0) - Number(dislikes || 0);
  const abs = Math.abs(score);
  if (abs >= 1000) {
    const compact = (abs / 1000).toFixed(abs >= 10000 ? 0 : 1).replace(/\.0$/, '');
    return `${score < 0 ? '-' : ''}${compact} тыс.`;
  }
  return String(score);
};

export const formatRelativeTime = (timestamp) => {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return formatFeedTime(timestamp);

  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'только что';
  if (minutes < 60) return `${minutes} мин. назад`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ч назад`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} дн. назад`;
  return formatFeedTime(timestamp);
};

export const resolvePostTitle = (post) => {
  const title = (post?.title || '').trim();
  if (title) return title;
  const text = (post?.text || '').trim();
  if (!text) return 'Без названия';
  const firstLine = text.split('\n')[0].trim();
  return firstLine || 'Без названия';
};

export const resolvePostPreview = (post, maxLen = 180) => {
  const text = (post?.text || '').trim();
  const title = (post?.title || '').trim();
  let body = text;
  if (title && text.startsWith(title)) {
    body = text.slice(title.length).trim();
  }
  if (!body) return '';
  if (body.length <= maxLen) return body;
  return `${body.slice(0, maxLen).trimEnd()}…`;
};

export const buildShareUrl = (postId) => {
  const base = `${window.location.origin}${window.location.pathname}${window.location.search}`;
  return `${base}#feed/${postId}`;
};
