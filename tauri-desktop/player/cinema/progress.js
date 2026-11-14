import { create } from 'zustand';

const STORAGE_KEY = 'whithin-cinema-progress-v1';
const LIMIT = 60;
/** Past this share of the runtime an episode counts as watched. */
export const WATCHED = 0.92;

const load = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
};

export const episodeKey = (season, episode) => `${season || 1}:${episode || 1}`;

/**
 * One entry per title: where the user stopped (for «Продолжить просмотр») plus the share watched of
 * every episode they opened (for the progress bars in the episode list).
 */
export const useProgress = create((set, get) => ({
  titles: load(),

  get(key) {
    return get().titles[key] || null;
  },

  fraction(key, season, episode) {
    return get().titles[key]?.episodes?.[episodeKey(season, episode)] || 0;
  },

  save(item, { season, episode, episodeName, translator, position, duration }) {
    if (!item?.key || !duration) return;
    const prev = get().titles[item.key] || {};
    const fraction = Math.min(1, position / duration);
    const entry = {
      key: item.key,
      source: item.source,
      id: item.id,
      title: item.title,
      poster: item.poster,
      season,
      episode,
      episodeName,
      translator: translator ?? prev.translator ?? null,
      position,
      duration,
      updatedAt: Date.now(),
      episodes: { ...prev.episodes, [episodeKey(season, episode)]: Math.max(fraction, prev.episodes?.[episodeKey(season, episode)] || 0) },
    };
    const titles = { ...get().titles, [item.key]: entry };
    const keys = Object.keys(titles).sort((a, b) => titles[b].updatedAt - titles[a].updatedAt);
    keys.slice(LIMIT).forEach((k) => delete titles[k]);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(titles));
    set({ titles });
  },

  remove(key) {
    const titles = { ...get().titles };
    delete titles[key];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(titles));
    set({ titles });
  },
}));

/** Unfinished titles first; finished movies drop out of «Продолжить». */
export const continueList = (titles) =>
  Object.values(titles)
    .filter((t) => t.duration && (t.position / t.duration < WATCHED || t.source === 'anime' || t.season))
    .sort((a, b) => b.updatedAt - a.updatedAt);
