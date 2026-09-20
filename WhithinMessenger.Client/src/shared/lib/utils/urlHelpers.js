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

  // Fallback для Electron с nodeIntegration/preload bridge
  try {
    if (typeof window?.require === 'function') {
      const electron = window.require('electron');
      if (electron?.shell?.openExternal) {
        electron.shell.openExternal(url);
        return;
      }
    }
  } catch {
    // Игнорируем и используем браузерный fallback ниже
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

export const fetchMediaBlob = async (rawUrl) => {
  const { directUrl, apiUrl, headers } = resolveMediaDownloadRequest(rawUrl);
  if (!directUrl && !apiUrl) {
    throw new Error('Invalid file URL');
  }

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

  // Для буфера обмена по-прежнему нужен полный blob.
  try {
    if (apiUrl) {
      return await tryDownload(apiUrl);
    }
    return await tryDownload(directUrl);
  } catch (primaryError) {
    if (!apiUrl || !directUrl) {
      throw primaryError;
    }
    return await tryDownload(directUrl);
  }
};

const triggerAnchorDownload = (url, fileName) => {
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName || 'download';
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
};

const downloadViaSaveFilePicker = async (urls, fileName, headers) => {
  const handle = await window.showSaveFilePicker({
    suggestedName: fileName || 'download',
  });

  let lastError = null;
  for (const url of urls) {
    let writable = null;
    try {
      writable = await handle.createWritable();
      const response = await fetch(url, {
        method: 'GET',
        credentials: 'include',
        headers,
      });
      if (!response.ok) {
        throw new Error(`Download failed with status ${response.status}`);
      }

      if (response.body?.pipeTo) {
        await response.body.pipeTo(writable);
        writable = null;
      } else {
        const buffer = await response.arrayBuffer();
        await writable.write(buffer);
        await writable.close();
        writable = null;
      }
      return;
    } catch (error) {
      lastError = error;
      if (writable) {
        try {
          await writable.abort();
        } catch {
          // ignore
        }
      }
    }
  }

  throw lastError || new Error('Download failed');
};

/**
 * Скачивание файла: сначала выбор пути, затем загрузка.
 * Раньше ждали полный blob в памяти — диалог «куда сохранить» открывался только после минутной загрузки.
 */
export const downloadMediaFile = async (rawUrl, fileName = 'download') => {
  const safeName = String(fileName || 'download').trim() || 'download';
  const { directUrl, apiUrl, headers } = resolveMediaDownloadRequest(rawUrl);
  const urls = [directUrl, apiUrl].filter(Boolean);

  if (urls.length === 0) {
    throw new Error('Invalid file URL');
  }

  // Electron: native Save dialog сразу, стрим в main process.
  if (typeof window !== 'undefined' && window.electronAPI?.saveMediaFile) {
    const result = await window.electronAPI.saveMediaFile({
      url: urls[0],
      fallbackUrl: urls[1] || '',
      fileName: safeName,
      headers,
    });
    if (result?.canceled) {
      return { canceled: true };
    }
    return result || { canceled: false };
  }

  // Chromium File System Access: picker сразу, затем stream.
  if (typeof window !== 'undefined' && typeof window.showSaveFilePicker === 'function') {
    try {
      await downloadViaSaveFilePicker(urls, safeName, headers);
      return { canceled: false };
    } catch (error) {
      // Пользователь отменил picker.
      if (error?.name === 'AbortError') {
        return { canceled: true };
      }
      // Если picker недоступен в контексте (iframe и т.п.) — fallback ниже.
      if (error?.name !== 'SecurityError' && error?.name !== 'NotAllowedError') {
        throw error;
      }
    }
  }

  // Web fallback: сразу клик по прямой ссылке (без предварительного fetch всего файла).
  triggerAnchorDownload(directUrl || apiUrl, safeName);
  return { canceled: false };
};

function resolveMediaDownloadRequest(rawUrl) {
  const directUrl = buildMediaUrl(rawUrl);
  const headers = {};
  const token = tokenManager.getToken();
  if (token && tokenManager.isTokenValid()) {
    headers.Authorization = `Bearer ${token}`;
  }

  const normalizedPath = typeof rawUrl === 'string' ? rawUrl.trim() : '';
  const cleanedPath = normalizedPath
    .replace(/^https?:\/\/[^/]+/i, '')
    .replace(/^\/+/, '');

  const apiUrl = cleanedPath
    ? `${BASE_URL}/api/media/download?filePath=${encodeURIComponent(cleanedPath)}`
    : '';

  return { directUrl, apiUrl, headers };
}
