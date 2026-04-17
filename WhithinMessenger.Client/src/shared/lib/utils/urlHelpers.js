import { BASE_URL, MEDIA_BASE_URL } from '../constants/apiEndpoints';
import tokenManager from '../services/tokenManager';

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

  URL_PATTERN.lastIndex = 0;

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

export const downloadMediaFile = async (rawUrl, fileName = 'download') => {
  const directUrl = buildMediaUrl(rawUrl);
  if (!directUrl) {
    throw new Error('Invalid file URL');
  }

  const headers = {};
  const token = tokenManager.getToken();
  if (token && tokenManager.isTokenValid()) {
    headers.Authorization = `Bearer ${token}`;
  }

  const normalizedPath = typeof rawUrl === 'string' ? rawUrl.trim() : '';
  const cleanedPath = normalizedPath
    .replace(/^https?:\/\/[^/]+/i, '')
    .replace(/^\/+/, '');

  const fallbackApiUrl = cleanedPath
    ? `${BASE_URL}/api/media/download?filePath=${encodeURIComponent(cleanedPath)}`
    : '';

  const tryDownload = async (url) => {
    const response = await fetch(url, {
      method: 'GET',
      credentials: 'include',
      headers,
    });

    if (!response.ok) {
      throw new Error(`Download failed with status ${response.status}`);
    }

    return response.blob();
  };

  let blob;
  try {
    blob = await tryDownload(directUrl);
  } catch (primaryError) {
    if (!fallbackApiUrl) {
      throw primaryError;
    }
    blob = await tryDownload(fallbackApiUrl);
  }

  const objectUrl = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = fileName || 'download';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(objectUrl);
};
