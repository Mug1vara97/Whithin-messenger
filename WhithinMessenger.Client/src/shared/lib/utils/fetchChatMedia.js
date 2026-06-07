import { BASE_URL } from '../constants/apiEndpoints';
import tokenManager from '../services/tokenManager';

function normalizeMediaFile(file) {
  if (!file || typeof file !== 'object') return null;

  const normalized = {
    id: file.id ?? file.Id,
    fileName: file.fileName ?? file.FileName ?? '',
    originalFileName: file.originalFileName ?? file.OriginalFileName ?? '',
    filePath: file.filePath ?? file.FilePath ?? '',
    contentType: file.contentType ?? file.ContentType ?? '',
    fileSize: file.fileSize ?? file.FileSize ?? 0,
    thumbnailPath: file.thumbnailPath ?? file.ThumbnailPath,
    createdAt: file.createdAt ?? file.CreatedAt,
    senderUsername: file.senderUsername ?? file.SenderUsername,
    caption: file.caption ?? file.Caption,
    isVideoNote: file.isVideoNote ?? file.IsVideoNote ?? false,
  };

  if (!normalized.id && !normalized.filePath) return null;
  return normalized;
}

function getMediaBatch(data) {
  if (Array.isArray(data?.mediaFiles)) return data.mediaFiles;
  if (Array.isArray(data?.MediaFiles)) return data.MediaFiles;
  return [];
}

export function collectMediaFromMessages(messages) {
  if (!Array.isArray(messages)) return [];

  const seen = new Set();
  const aggregated = [];

  const addFiles = (files) => {
    if (!Array.isArray(files)) return;
    for (const file of files) {
      const normalized = normalizeMediaFile(file);
      if (!normalized) continue;
      const key = String(normalized.id || normalized.filePath);
      if (seen.has(key)) continue;
      seen.add(key);
      aggregated.push(normalized);
    }
  };

  for (const message of messages) {
    addFiles(message.mediaFiles ?? message.MediaFiles);
    const forwarded = message.forwardedMessage ?? message.ForwardedMessage;
    if (forwarded) {
      addFiles(forwarded.mediaFiles ?? forwarded.MediaFiles);
    }
  }

  return aggregated;
}

export async function fetchAllChatMediaFiles(chatId, { pageSize = 100, maxPages = 20 } = {}) {
  if (!chatId) return [];

  const aggregated = [];
  let page = 1;
  let hasMore = true;

  const headers = {};
  const token = tokenManager.getToken();
  if (token && tokenManager.isTokenValid()) {
    headers.Authorization = `Bearer ${token}`;
  }

  while (hasMore && page <= maxPages) {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
    });

    const response = await fetch(`${BASE_URL}/api/media/${chatId}?${params}`, {
      credentials: 'include',
      headers,
    });

    if (!response.ok) {
      throw new Error(`Failed to load chat media (${response.status})`);
    }

    const data = await response.json();
    const batch = getMediaBatch(data)
      .map(normalizeMediaFile)
      .filter(Boolean);

    aggregated.push(...batch);
    hasMore = Boolean(data.hasMore ?? data.HasMore) && batch.length > 0;
    page += 1;
  }

  const seen = new Set();
  return aggregated.filter((file) => {
    const key = String(file.id || file.filePath || '');
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
