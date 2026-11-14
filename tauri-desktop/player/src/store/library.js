import { create } from 'zustand';
import { invoke } from '../lib/tauri';

const SYNC_ON_FOCUS_MS = 60_000;

const VERSIONS = ['remix', 'slow', 'sped up', 'speed up', 'reverb', 'cover', 'кавер', 'karaoke', 'instrumental', 'nightcore', 'минус', 'live', 'acoustic', '8d'];

const comparable = (text) =>
  (text || '')
    .toLocaleLowerCase('ru-RU')
    .replace(/ё/g, 'е')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

/**
 * The same song under another id (a video, a SoundCloud upload, a catalog track) gets the same key:
 * main artist, title without brackets ("(prod. by Yusei)"), and which remix/slowed/cover it is.
 */
function songKey({ artist, title }) {
  const full = ` ${comparable(title)} `;
  const versions = VERSIONS.filter((w) => full.includes(` ${w} `)).sort().join(',');
  const mainArtist = (artist || '').split(/\s*(?:,|&|\/|\bfeat\.?|\bft\.?|\sx\s)\s*/i)[0];
  const bare = (title || '').replace(/\s*[([【][^)\]】]*[)\]】]/g, '').trim() || title;
  return `${comparable(mainArtist)}|${comparable(bare)}|${versions}`;
}

export const isLocalFile = (track) => Boolean(track?.videoId?.startsWith('lf-'));

/** The saved entry for this song: the same id, or the same song saved from another source. */
export function libraryIdFor(state, track) {
  if (!track) return null;
  if (state.ids.has(track.videoId)) return track.videoId;
  return state.byKey.get(songKey(track)) || null;
}

export const useLibrary = create((set, get) => ({
  tracks: [],
  ids: new Set(),
  byKey: new Map(),
  /** Files in `Music\Whithin` on this computer; not part of the account's list. */
  localTracks: [],
  localFolder: '',
  /** Account tracks saved on this computer, and the ones being saved right now. */
  downloaded: new Set(),
  downloading: new Set(),
  /** "Download all" progress, or null. */
  bulk: null,
  signedIn: false,
  username: null,
  online: true,
  pending: 0,
  loaded: false,
  lastSync: 0,

  apply(state) {
    if (!state) return;
    const tracks = state.tracks || [];
    set({
      tracks,
      ids: new Set(tracks.map((t) => t.videoId)),
      byKey: new Map(tracks.map((t) => [songKey(t), t.videoId])),
      signedIn: Boolean(state.signedIn),
      username: state.username || null,
      online: Boolean(state.online),
      pending: state.pending || 0,
      loaded: true,
    });
  },

  async load() {
    get().apply(await invoke('music_library_local').catch(() => null));
    get().loadLocal();
    get().loadDownloads();
    await get().sync();
  },

  async loadLocal() {
    const state = await invoke('music_local_tracks').catch(() => null);
    if (state) set({ localTracks: state.tracks || [], localFolder: state.folder || '' });
  },

  openLocalFolder() {
    invoke('music_local_open').catch(() => {});
  },

  async loadDownloads() {
    const ids = await invoke('music_downloads').catch(() => null);
    if (ids) set({ downloaded: new Set(ids) });
  },

  async download(track) {
    const id = track?.videoId;
    if (!id || isLocalFile(track) || get().downloaded.has(id) || get().downloading.has(id)) return true;
    set((s) => ({ downloading: new Set(s.downloading).add(id) }));
    const ok = await invoke('music_download', { trackId: id }).then(
      () => true,
      () => false,
    );
    set((s) => {
      const downloading = new Set(s.downloading);
      downloading.delete(id);
      const downloaded = ok ? new Set(s.downloaded).add(id) : s.downloaded;
      return { downloading, downloaded };
    });
    return ok;
  },

  async deleteDownload(track) {
    const id = track?.videoId;
    if (!id) return;
    await invoke('music_download_delete', { trackId: id }).catch(() => {});
    set((s) => {
      const downloaded = new Set(s.downloaded);
      downloaded.delete(id);
      return { downloaded };
    });
  },

  /** Downloads the account tracks not saved on this computer yet, one at a time. */
  async downloadAll() {
    if (get().bulk) return;
    const queue = get().tracks.filter((t) => !get().downloaded.has(t.videoId));
    set({ bulk: { done: 0, total: queue.length, failed: 0 } });
    for (const track of queue) {
      if (!get().bulk) break;
      const ok = await get().download(track);
      set((s) => s.bulk && { bulk: { ...s.bulk, done: s.bulk.done + 1, failed: s.bulk.failed + (ok ? 0 : 1) } });
    }
    set({ bulk: null });
  },

  stopDownloadAll() {
    set({ bulk: null });
  },

  async sync() {
    set({ lastSync: Date.now() });
    get().apply(await invoke('music_library_sync').catch(() => null));
  },

  syncIfStale() {
    get().loadLocal();
    if (Date.now() - get().lastSync > SYNC_ON_FOCUS_MS) get().sync();
  },

  async toggle(track) {
    if (!track || isLocalFile(track)) return;
    const savedId = libraryIdFor(get(), track);
    const saved = savedId && get().tracks.find((t) => t.videoId === savedId);
    const { videoId, title, artist, durationSeconds, thumbnailUrl } = saved || track;
    const payload = { videoId, title, artist, durationSeconds, thumbnailUrl };
    get().apply(await invoke('music_library_toggle', { track: payload }).catch(() => null));
    if (saved && get().downloaded.has(videoId)) get().deleteDownload(saved);
  },
}));
