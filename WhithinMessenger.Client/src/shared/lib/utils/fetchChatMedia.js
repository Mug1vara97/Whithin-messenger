import { BASE_URL } from '../constants/apiEndpoints';

export async function fetchAllChatMediaFiles(chatId, { pageSize = 100, maxPages = 20 } = {}) {
  if (!chatId) return [];

  const aggregated = [];
  let page = 1;
  let hasMore = true;

  while (hasMore && page <= maxPages) {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
    });

    const response = await fetch(`${BASE_URL}/api/media/${chatId}?${params}`, {
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error(`Failed to load chat media (${response.status})`);
    }

    const data = await response.json();
    const batch = Array.isArray(data.mediaFiles) ? data.mediaFiles : [];
    aggregated.push(...batch);
    hasMore = Boolean(data.hasMore) && batch.length > 0;
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
