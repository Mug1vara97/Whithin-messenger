import { create } from 'zustand';
import { invoke } from '../lib/tauri';
import { describeError } from '../lib/format';

const DEBOUNCE_MS = 450;
let timer = null;
let token = 0;

export const useSearch = create((set, get) => ({
  query: '',
  /** Query the current results belong to. */
  searched: '',
  tab: 'all',
  results: [],
  artists: [],
  searchId: null,
  hasMore: false,
  searching: false,
  error: null,

  setQuery(query) {
    set({ query });
    clearTimeout(timer);
    timer = setTimeout(() => get().run(), DEBOUNCE_MS);
  },

  setTab(tab) {
    set({ tab });
  },

  async run() {
    const query = get().query.trim();
    const current = ++token;
    if (query.length < 2) {
      set({ results: [], artists: [], searchId: null, hasMore: false, searching: false, error: null });
      return;
    }
    set({ searching: true, error: null });
    const [tracks, artists] = await Promise.allSettled([
      invoke('music_search', { query }),
      invoke('music_search_artists', { query }),
    ]);
    if (current !== token) return;
    const page = tracks.status === 'fulfilled' ? tracks.value : null;
    set({
      searched: query,
      results: page?.tracks || [],
      searchId: page?.searchId || null,
      hasMore: !!page?.hasMore,
      artists: artists.status === 'fulfilled' ? artists.value : [],
      searching: false,
      error: page || artists.status === 'fulfilled' ? null : describeError(tracks.reason),
    });
  },

  async more() {
    const { searchId, hasMore, searching } = get();
    if (!searchId || !hasMore || searching) return;
    const current = token;
    set({ searching: true });
    try {
      const page = await invoke('music_search_more', { searchId });
      if (current !== token) return;
      const seen = new Set(get().results.map((t) => t.videoId));
      set({
        results: get().results.concat(page.tracks.filter((t) => !seen.has(t.videoId))),
        hasMore: page.hasMore,
        searching: false,
      });
    } catch (error) {
      if (current !== token) return;
      set({ hasMore: false, searching: false, error: describeError(error) });
    }
  },
}));
