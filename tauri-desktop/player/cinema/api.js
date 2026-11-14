import { invoke } from '../src/lib/tauri';

const ANILIBRIA = 'https://aniliberty.top';
const SCHEME = 'whithin-cinema';
const WINDOWS = /Windows/i.test(navigator.userAgent);

/** Same URL shape as the Rust `proxy::proxied`: CDNs send no CORS headers and Rezka checks the Referer. */
export function proxied(url, referer) {
  if (!url) return null;
  const query = new URLSearchParams({ u: url });
  if (referer) query.set('r', referer);
  return WINDOWS ? `http://${SCHEME}.localhost/m?${query}` : `${SCHEME}://localhost/m?${query}`;
}

const pick = (...values) => values.find((v) => v !== undefined && v !== null && v !== '');
const join = (...parts) => parts.filter(Boolean).join(' · ');

/* ---------- AniLibria: anime ---------- */

const libUrl = (path) => (path ? (path.startsWith('http') ? path : ANILIBRIA + path) : null);
const libImage = (image, size = 'src') => proxied(libUrl(pick(image?.optimized?.[size], image?.[size], image?.src)));
const anilibria = (path, query) => invoke('cinema_anilibria', { path, query: query ? Object.entries(query) : null });

const animeItem = (r) => ({
  source: 'anime',
  key: `anime:${r.id}`,
  id: r.id,
  title: r.name?.main || r.name?.english || 'Без названия',
  subtitle: join(r.year, r.type?.description, r.episodes_total ? `${r.episodes_total} эп.` : null),
  poster: libImage(r.poster, 'preview'),
  badge: r.is_ongoing ? 'Онгоинг' : r.type?.description || null,
});

export const anime = {
  sections: [
    { id: 'latest', title: 'Новые серии' },
    { id: 'top', title: 'Популярное' },
    { id: 'today', title: 'Выходит сегодня' },
  ],

  async list(section, page = 1) {
    if (section === 'today') {
      if (page > 1) return [];
      const schedule = await anilibria('anime/schedule/now');
      return (schedule.today || []).map((x) => animeItem(x.release));
    }
    if (section === 'top') {
      const res = await anilibria('anime/catalog/releases', { limit: 30, page, 'f[sorting]': 'RATING_DESC' });
      return (res.data || []).map(animeItem);
    }
    if (page > 1) return [];
    return (await anilibria('anime/releases/latest', { limit: 30 })).map(animeItem);
  },

  async search(query) {
    return (await anilibria('app/search/releases', { query })).map(animeItem);
  },

  async title(id) {
    const r = await anilibria(`anime/releases/${id}`);
    const episodes = (r.episodes || [])
      .slice()
      .sort((a, b) => (a.sort_order ?? a.ordinal) - (b.sort_order ?? b.ordinal))
      .map((e) => ({
        season: 1,
        episode: e.ordinal,
        name: e.name ? `${e.ordinal}. ${e.name}` : `Эпизод ${e.ordinal}`,
        preview: libImage(e.preview, 'thumbnail'),
        duration: e.duration || 0,
        opening: e.opening?.start != null && e.opening?.stop != null ? e.opening : null,
        ending: e.ending?.start != null && e.ending?.stop != null ? e.ending : null,
        streams: [
          ['1080p', 1080, e.hls_1080],
          ['720p', 720, e.hls_720],
          ['480p', 480, e.hls_480],
        ]
          .filter(([, , url]) => url)
          .map(([label, height, url]) => ({ label, height, url: proxied(url), kind: 'hls' }))
          .reverse(),
      }));
    return {
      ...animeItem(r),
      original: pick(r.name?.english, r.name?.alternative),
      description: r.description || '',
      backdrop: libImage(r.poster, 'src'),
      facts: [
        r.season?.description && r.year ? `${r.season.description} ${r.year}` : r.year,
        r.type?.description,
        r.age_rating?.label,
        r.is_ongoing ? 'Онгоинг' : 'Завершён',
        r.average_duration_of_episode ? `~${r.average_duration_of_episode} мин` : null,
      ].filter(Boolean),
      genres: (r.genres || []).map((g) => g.name),
      rating: r.shikimori?.rating ? { label: 'Shikimori', value: r.shikimori.rating } : null,
      kind: 'series',
      voice: 'AniLibria',
      episodes,
      seasons: [{ id: 1, name: 'Эпизоды' }],
    };
  },
};

/* ---------- HDRezka: films & series ---------- */

const rezka = (op, args) => invoke('cinema_rezka', { op, args });
let referer = 'https://rezka.ag/';

const rezkaItem = (it) => ({
  source: 'rezka',
  key: `rezka:${it.id || it.url}`,
  id: it.url,
  title: it.title,
  subtitle: it.meta,
  poster: proxied(it.poster, referer),
  badge: it.kind || null,
  note: it.info || null,
});

const fact = (info, key) => info?.[key] || null;

export const films = {
  sections: [
    { id: '/films/?filter=popular', title: 'Фильмы' },
    { id: '/series/?filter=popular', title: 'Сериалы' },
    { id: '/cartoons/?filter=popular', title: 'Мультфильмы' },
    { id: '/new/', title: 'Новинки' },
  ],

  async list(path, page = 1) {
    return (await rezka('list', { path, page })).items.map(rezkaItem);
  },

  async search(query) {
    return (await rezka('search', { query })).items.map(rezkaItem);
  },

  async title(url) {
    const p = await rezka('post', { url });
    const series = p.type === 'tv_series';
    return {
      source: 'rezka',
      key: `rezka:${p.id}`,
      id: p.url,
      postId: p.id,
      title: p.title,
      original: p.original,
      poster: proxied(p.poster, referer),
      backdrop: proxied(p.poster, referer),
      description: p.description,
      facts: [fact(p.info, 'Дата выхода'), fact(p.info, 'Страна'), fact(p.info, 'Время'), fact(p.info, 'Возраст'), p.status].filter(Boolean),
      genres: (fact(p.info, 'Жанр') || '').split(',').map((g) => g.trim()).filter(Boolean),
      rating: p.imdb ? { label: 'IMDb', value: p.imdb } : p.kp ? { label: 'Кинопоиск', value: p.kp } : null,
      kind: series ? 'series' : 'movie',
      translator: p.translator,
      translators: p.translators,
      seasons: p.seasons,
      episodes: p.episodes,
      restricted: p.restricted,
    };
  },

  episodes(postId, translator) {
    return rezka('episodes', { id: postId, translator });
  },

  async stream({ postId, translator, season, episode, movie }) {
    const t = typeof translator === 'object' ? translator : { id: translator };
    const res = await rezka('stream', {
      id: postId,
      translator: t.id,
      season,
      episode,
      movie,
      camrip: t.camrip,
      ads: t.ads,
      director: t.director,
    });
    if (res.referer) referer = res.referer;
    if (res.restricted) throw new Error(res.restricted);
    return {
      streams: res.streams
        .map((s) => ({
          label: s.label,
          height: s.height,
          url: proxied(s.hls || s.mp4, res.referer),
          kind: s.hls ? 'hls' : 'file',
        }))
        .reverse(),
      subtitles: res.subtitles.map((s) => ({ label: s.label, url: proxied(s.url, res.referer) })),
    };
  },

  openAccount() {
    return invoke('cinema_rezka_account');
  },
};

export const sourceFor = (item) => (item.source === 'anime' ? anime : films);
