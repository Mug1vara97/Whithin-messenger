import { create } from 'zustand';
import { recentTracks } from '../lib/history';
import { invoke } from '../lib/tauri';
import { useLibrary } from './library';

const CACHE_KEY = 'whithin.music.forYou';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const SEEDS = 4;
const MIX_SIZE = 50;
const SHELF_SIZE = 15;
const ARTISTS = 8;

const shuffled = (list) => {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

const firstArtist = (artist) => (artist || '').split(/,|&| feat\.| ft\.| и /i)[0].trim();

/** Recent listening first (one track per artist), then the library fills the rest. */
function pickSeeds(library) {
  const seeds = [];
  const artists = new Set();
  const add = (track, reason) => {
    const key = firstArtist(track.artist).toLowerCase();
    if (!track.videoId || artists.has(key)) return;
    artists.add(key);
    seeds.push({ track, reason });
  };
  for (const track of recentTracks()) {
    if (seeds.length >= Math.ceil(SEEDS / 2)) break;
    add(track, `Вы недавно слушали «${track.title}»`);
  }
  for (const track of shuffled(library)) {
    if (seeds.length >= SEEDS) break;
    add(track, `Из вашей библиотеки: «${track.title}»`);
  }
  return seeds;
}

function interleave(lists) {
  const out = [];
  const seen = new Set();
  const queues = lists.map(shuffled);
  while (out.length < MIX_SIZE && queues.some((q) => q.length)) {
    for (const queue of queues) {
      const track = queue.shift();
      if (track && !seen.has(track.videoId)) {
        seen.add(track.videoId);
        out.push(track);
      }
    }
  }
  return out.slice(0, MIX_SIZE);
}

async function resolveArtists(radios, owned) {
  const counts = new Map();
  for (const track of radios.flat()) {
    const name = firstArtist(track.artist);
    if (!name || owned.has(name.toLowerCase())) continue;
    counts.set(name, (counts.get(name) || 0) + 1);
  }
  const names = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, ARTISTS + 4)
    .map(([name]) => name);
  const found = await Promise.all(
    names.map((name) =>
      invoke('music_search_artists', { query: name })
        .then((list) => list.find((a) => a.name.toLowerCase() === name.toLowerCase()) || null)
        .catch(() => null),
    ),
  );
  const unique = new Map();
  for (const artist of found) if (artist && !unique.has(artist.id)) unique.set(artist.id, artist);
  return [...unique.values()].slice(0, ARTISTS);
}

function readCache() {
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY));
    return cached && Date.now() - cached.at < CACHE_TTL_MS ? cached : null;
  } catch {
    return null;
  }
}

export const useForYou = create((set, get) => ({
  mix: [],
  artists: [],
  shelves: [],
  loading: false,
  loaded: false,

  restore() {
    const cached = readCache();
    if (cached) set({ mix: cached.mix, artists: cached.artists, shelves: cached.shelves, loaded: true });
    return Boolean(cached);
  },

  ensure() {
    if (get().loaded || get().loading) return;
    if (!get().restore()) get().refresh();
  },

  async refresh() {
    const library = useLibrary.getState().tracks;
    const seeds = pickSeeds(library);
    if (!seeds.length) {
      set({ mix: [], artists: [], shelves: [], loaded: true });
      return;
    }
    set({ loading: true });
    const ownedIds = useLibrary.getState().ids;
    const seedIds = new Set(seeds.map((s) => s.track.videoId));
    const ownedArtists = new Set(library.map((t) => firstArtist(t.artist).toLowerCase()));

    const radios = await Promise.all(
      seeds.map(({ track }) =>
        invoke('music_radio', { seed: track.videoId })
          .then((list) => list.filter((t) => t.durationSeconds > 0 && !ownedIds.has(t.videoId) && !seedIds.has(t.videoId)))
          .catch(() => []),
      ),
    );

    const mix = interleave(radios);
    const inMix = new Set(mix.map((t) => t.videoId));
    const shelves = seeds
      .map(({ track, reason }, i) => ({
        id: track.videoId,
        title: `Похоже на ${firstArtist(track.artist) || track.title}`,
        subtitle: reason,
        tracks: radios[i].filter((t) => !inMix.has(t.videoId)).slice(0, SHELF_SIZE),
      }))
      .filter((shelf) => shelf.tracks.length >= 4);
    const artists = await resolveArtists(radios, ownedArtists);

    const result = { mix, artists, shelves };
    set({ ...result, loading: false, loaded: true });
    if (mix.length) localStorage.setItem(CACHE_KEY, JSON.stringify({ ...result, at: Date.now() }));
  },
}));
