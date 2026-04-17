import { MEDIA_BASE_URL } from '../constants/apiEndpoints';

const URL_PATTERN = /((?:https?:\/\/|www\.)[^\s<>"'`]+)/gi;

export const buildMediaUrl = (rawPath) => {
  if (!rawPath || typeof rawPath !== 'string') {
    return '';
  }

  if (/^https?:\/\//i.test(rawPath)) {
    return rawPath;
  }

  const normalizedPath = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;

  if (!MEDIA_BASE_URL) {
    return normalizedPath;
  }

  const normalizedBase = MEDIA_BASE_URL.endsWith('/')
    ? MEDIA_BASE_URL.slice(0, -1)
    : MEDIA_BASE_URL;

  return `${normalizedBase}${normalizedPath}`;
};

export const normalizeExternalUrl = (rawUrl) => {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return '';
  }

  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return '';
  }

  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
};

export const openExternalUrl = (rawUrl) => {
  const url = normalizeExternalUrl(rawUrl);
  if (!url) {
    return;
  }

  const electronBridge = window?.electronAPI || window?.electron;

  if (electronBridge?.openExternal) {
    electronBridge.openExternal(url);
    return;
  }

  window.open(url, '_blank', 'noopener,noreferrer');
};

export const splitTextWithLinks = (text) => {
  if (!text || typeof text !== 'string') {
    return [];
  }

  const parts = [];
  let lastIndex = 0;
  let match;

  while ((match = URL_PATTERN.exec(text)) !== null) {
    const matchedUrl = match[0];
    const matchStart = match.index;
    const matchEnd = matchStart + matchedUrl.length;

    if (matchStart > lastIndex) {
      parts.push({ type: 'text', value: text.slice(lastIndex, matchStart) });
    }

    parts.push({
      type: 'link',
      value: matchedUrl,
      href: normalizeExternalUrl(matchedUrl),
    });

    lastIndex = matchEnd;
  }

  if (lastIndex < text.length) {
    parts.push({ type: 'text', value: text.slice(lastIndex) });
  }

  return parts;
};
