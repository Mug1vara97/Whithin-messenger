/**
 * Провайдер Яндекс.Музыки: поиск и получение URL потока для воспроизведения.
 * Использует ym-api-meowed (токен + uid из env).
 */
const { WrappedYMApi } = require('ym-api-meowed');

let wrappedApi = null;
let initPromise = null;

function getApi() {
  if (!wrappedApi) {
    wrappedApi = new WrappedYMApi();
  }
  return wrappedApi;
}

async function ensureInit() {
  if (initPromise) return initPromise;
  const token = process.env.YANDEX_MUSIC_TOKEN || process.env.YM_ACCESS_TOKEN;
  const uid = parseInt(process.env.YANDEX_MUSIC_UID || process.env.YM_UID || '0', 10);
  if (!token || !uid) {
    throw new Error('YANDEX_MUSIC_TOKEN and YANDEX_MUSIC_UID (or YM_ACCESS_TOKEN, YM_UID) must be set for Yandex Music');
  }
  initPromise = getApi().init({ access_token: token, uid });
  await initPromise;
  return initPromise;
}

/**
 * Проверяет, похож ли ввод на ссылку Яндекс.Музыки.
 */
function isYandexUrl(input) {
  if (typeof input !== 'string') return false;
  const t = input.trim();
  return /music\.yandex\.(ru|com)\//i.test(t) || /yandex\.ru\/music\//i.test(t);
}

/**
 * Извлекает trackId из URL вида:
 * - https://music.yandex.ru/album/123/track/456
 * - https://music.yandex.ru/track/456
 */
function extractTrackIdFromUrl(url) {
  const m = url.match(/track\/(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

/**
 * По входной строке (ссылка или поисковый запрос) возвращает URL потока для ffmpeg.
 * @param {string} input - Ссылка на трек/альбом или поисковый запрос (название/исполнитель)
 * @returns {Promise<{ streamUrl: string, title?: string }>}
 */
async function resolveToStreamUrl(input) {
  await ensureInit();
  const api = getApi();
  const plainApi = api.getApi();
  const text = (input && typeof input === 'string' ? input : '').trim();
  if (!text) {
    throw new Error('Пустой запрос: укажите ссылку Яндекс.Музыки или поисковый запрос');
  }

  let trackIdOrUrl = null;
  let title = null;

  if (isYandexUrl(text)) {
    const trackId = extractTrackIdFromUrl(text);
    if (trackId) {
      trackIdOrUrl = trackId;
      try {
        const track = await api.getTrack(trackId);
        title = track ? `${track.title} — ${(track.artists || []).map(a => a.name).join(', ')}` : null;
      } catch (_) {
        // ignore
      }
    } else {
      // Ссылка на альбом/плейлист без конкретного трека — не поддерживаем как один трек
      throw new Error('Укажите ссылку именно на трек: …/track/123 или …/album/…/track/123');
    }
  } else {
    // Поиск по запросу
    const searchResult = await plainApi.searchTracks(text, { page: 0, pageSize: 5 });
    const tracks = searchResult?.tracks?.results;
    if (!tracks || tracks.length === 0) {
      throw new Error(`По запросу «${text}» ничего не найдено в Яндекс.Музыке`);
    }
    const first = tracks[0];
    trackIdOrUrl = first.id;
    title = first.title && first.artists?.length
      ? `${first.title} — ${first.artists.map(a => a.name).join(', ')}`
      : first.title || null;
  }

  const streamUrl = await api.getMp3DownloadUrl(trackIdOrUrl);
  if (!streamUrl || !streamUrl.startsWith('http')) {
    throw new Error('Не удалось получить ссылку на поток');
  }
  return { streamUrl, title };
}

module.exports = {
  resolveToStreamUrl,
  isYandexUrl,
  ensureInit
};
