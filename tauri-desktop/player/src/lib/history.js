const KEY = 'whithin.music.history';
const LIMIT = 100;

/** Most recent first; one entry per track. */
export function recentTracks() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || [];
  } catch {
    return [];
  }
}

export function rememberPlayed(track) {
  if (!track?.videoId) return;
  const { videoId, title, artist, artistId, durationSeconds, thumbnailUrl } = track;
  const entry = { videoId, title, artist, artistId, durationSeconds, thumbnailUrl };
  const list = [entry, ...recentTracks().filter((t) => t.videoId !== videoId)].slice(0, LIMIT);
  localStorage.setItem(KEY, JSON.stringify(list));
}
