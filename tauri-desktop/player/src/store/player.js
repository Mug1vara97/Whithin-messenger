import { create } from 'zustand';
import { engine, mediaKeys } from '../lib/engine';
import { rememberPlayed } from '../lib/history';
import { invoke } from '../lib/tauri';
import { describeError } from '../lib/format';

const VOLUME_KEY = 'whithin.music.volume';
const MAX_FAILURES_IN_A_ROW = 3;
const MAX_RECOVERIES = 3;
/** `ended` this far before the known track length means the stream was cut, not finished. */
const EARLY_END_SECONDS = 5;

const savedVolume = Number(localStorage.getItem(VOLUME_KEY));
const initialVolume = localStorage.getItem(VOLUME_KEY) !== null && savedVolume >= 0 && savedVolume <= 1 ? savedVolume : 0.8;

const shuffled = (items) => {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

let loadToken = 0;
/** Token of the load the audio host currently holds (null: nothing loaded). */
let loaded = null;
let failures = 0;
let recoveries = 0;
let mutedVolume = initialVolume || 0.8;
let extending = false;

export const usePlayer = create((set, get) => ({
  queue: [],
  original: [],
  index: -1,
  source: null,
  playing: false,
  buffering: false,
  position: 0,
  duration: 0,
  volume: initialVolume,
  shuffle: false,
  repeat: 'off',
  error: null,
  radioLoading: false,

  current() {
    const { queue, index } = get();
    return index >= 0 ? queue[index] || null : null;
  },

  playList(tracks, start = 0, { shuffle = false, source = null } = {}) {
    if (!tracks.length) return;
    const first = tracks[start];
    const queue = shuffle ? [first, ...shuffled(tracks.filter((_, i) => i !== start))] : [...tracks];
    failures = 0;
    set({ original: [...tracks], queue, index: shuffle ? 0 : start, shuffle, source });
    get().load();
  },

  shuffleList(tracks, source = null) {
    if (!tracks.length) return;
    get().playList(tracks, Math.floor(Math.random() * tracks.length), { shuffle: true, source });
  },

  /** Endless mix seeded by a track id or an artist radio id. */
  async playRadio(seed, { source = 'radio', lead = null } = {}) {
    set({ radioLoading: true });
    try {
      const tracks = await invoke('music_radio', { seed });
      const list = lead ? [lead, ...tracks.filter((t) => t.videoId !== lead.videoId)] : tracks;
      if (list.length) get().playList(list, 0, { source });
      set({ radioLoading: false });
    } catch (error) {
      set({ radioLoading: false, error: describeError(error) });
    }
  },

  jumpTo(index) {
    if (index < 0 || index >= get().queue.length) return;
    failures = 0;
    set({ index });
    get().load();
  },

  /** `resumeAt` reconnects the current track at that second instead of starting it over. */
  load(resumeAt = null, { fresh = false, retry = false } = {}) {
    const track = get().current();
    if (!track) return;
    const resuming = resumeAt !== null;
    if (!retry) recoveries = 0;
    set({
      error: null,
      buffering: true,
      playing: true,
      ...(resuming ? {} : { position: 0, duration: track.durationSeconds || 0 }),
    });
    if (!resuming) {
      mediaKeys.setTrack(track);
      rememberPlayed(track);
    }
    mediaKeys.setPlaying(true);
    loadToken = engine.load(track.videoId, { start: resumeAt || 0, volume: get().volume, fresh });
    loaded = loadToken;
  },

  /** A dropped stream is reconnected with a fresh URL; only a track that keeps failing is skipped. */
  recover() {
    if (recoveries >= MAX_RECOVERIES) return false;
    recoveries += 1;
    const at = get().position;
    console.warn('[music] stream failed, reconnecting at', at);
    get().load(at > 1 ? at : null, { fresh: true, retry: true });
    return true;
  },

  skipAfterFailure() {
    failures += 1;
    if (failures < MAX_FAILURES_IN_A_ROW) get().next(true);
    else get().halt();
  },

  halt() {
    engine.stop();
    loaded = null;
    set({ playing: false, buffering: false });
    mediaKeys.setPlaying(false);
  },

  async next(auto = false) {
    const { queue, index, repeat } = get();
    if (!queue.length) return;
    if (!auto) failures = 0;
    if (index + 1 < queue.length) {
      set({ index: index + 1 });
    } else if (repeat === 'all') {
      set({ index: 0 });
    } else if (await get().extendWithRadio()) {
      set({ index: get().index + 1 });
    } else if (!auto) {
      set({ index: 0 });
    } else {
      get().halt();
      return;
    }
    get().load();
  },

  /** Queue ran out: append tracks similar to the last one, like Spotify's autoplay. */
  async extendWithRadio() {
    const last = get().queue[get().queue.length - 1];
    if (!last || extending) return false;
    extending = true;
    set({ radioLoading: true });
    try {
      const tracks = await invoke('music_radio', { seed: last.videoId });
      const seen = new Set(get().queue.map((t) => t.videoId));
      const fresh = tracks.filter((t) => !seen.has(t.videoId));
      if (!fresh.length) return false;
      set({ queue: [...get().queue, ...fresh], original: [...get().original, ...fresh] });
      return true;
    } catch {
      return false;
    } finally {
      extending = false;
      set({ radioLoading: false });
    }
  },

  previous() {
    if (get().position > 3) {
      get().seek(0);
      return;
    }
    const { queue, index } = get();
    if (!queue.length) return;
    set({ index: index > 0 ? index - 1 : queue.length - 1 });
    get().load();
  },

  togglePlay() {
    if (!get().current()) return;
    if (loaded === null) {
      get().load(get().position > 1 ? get().position : null);
    } else if (get().playing) {
      engine.pause();
      set({ playing: false });
      mediaKeys.setPlaying(false);
    } else {
      engine.play();
      set({ playing: true });
      mediaKeys.setPlaying(true);
    }
  },

  toggleShuffle() {
    const { shuffle, queue, index, original } = get();
    const track = get().current();
    if (!shuffle) {
      const rest = queue.filter((_, i) => i !== index);
      set({ queue: track ? [track, ...shuffled(rest)] : shuffled(rest), index: track ? 0 : -1, shuffle: true });
    } else {
      const restored = [...original];
      set({
        queue: restored,
        index: track ? restored.findIndex((t) => t.videoId === track.videoId) : -1,
        shuffle: false,
      });
    }
  },

  cycleRepeat() {
    const order = ['off', 'all', 'one'];
    set({ repeat: order[(order.indexOf(get().repeat) + 1) % order.length] });
  },

  seek(seconds) {
    if (loaded === null) {
      set({ position: seconds });
      return;
    }
    engine.seek(seconds);
    set({ position: seconds });
  },

  setVolume(value) {
    const volume = Math.min(Math.max(value, 0), 1);
    localStorage.setItem(VOLUME_KEY, String(volume));
    set({ volume });
    if (loaded !== null) engine.setVolume(volume);
  },

  toggleMute() {
    const { volume } = get();
    if (volume > 0) {
      mutedVolume = volume;
      get().setVolume(0);
    } else get().setVolume(mutedVolume || 0.8);
  },
}));

const store = usePlayer;

engine.subscribe((event) => {
  const state = store.getState();
  if (event.event === 'host-exit') {
    if (loaded === null) return;
    loaded = null;
    if (state.playing && !state.recover()) state.halt();
    return;
  }
  if (event.token !== loadToken) return;

  switch (event.event) {
    case 'loading':
      store.setState({ buffering: true });
      break;
    case 'ready':
      if (event.duration > 0) store.setState({ duration: event.duration });
      break;
    case 'time': {
      const update = { position: event.position, buffering: event.buffering };
      if (event.duration > 0) update.duration = event.duration;
      if (event.playing && !event.buffering && event.position > 0.5) {
        failures = 0;
      }
      store.setState(update);
      break;
    }
    case 'ended': {
      loaded = null;
      const expected = state.current()?.durationSeconds || state.duration || 0;
      if (expected && state.position < expected - EARLY_END_SECONDS && state.recover()) return;
      if (state.repeat === 'one') state.load();
      else state.next(true);
      break;
    }
    case 'error': {
      loaded = null;
      console.warn('[music] playback error', event.message);
      const message = String(event.message || '');
      const retryable = !message.startsWith('unavailable:') && !message.startsWith('decode:');
      if (retryable && state.recover()) return;
      store.setState({ error: describeError(message), buffering: false });
      state.skipAfterFailure();
      break;
    }
    default:
      break;
  }
});

mediaKeys.bind({
  play: () => store.getState().togglePlay(),
  pause: () => store.getState().togglePlay(),
  nexttrack: () => store.getState().next(),
  previoustrack: () => store.getState().previous(),
});
