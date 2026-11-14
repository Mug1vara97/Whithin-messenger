import { libraryIdFor, useLibrary } from '../store/library';
import { usePlayer } from '../store/player';
import { emitTo, listen } from './tauri';

/**
 * Mirrors playback to the site's titlebar mini player (webview "main") and executes the
 * commands it sends back, so the music can be controlled without opening the player.
 */
const SITE = { kind: 'Webview', label: 'main' };
const MIN_INTERVAL_MS = 250;

function snapshot() {
  const player = usePlayer.getState();
  const track = player.current();
  return {
    track: track
      ? {
          videoId: track.videoId,
          title: track.title,
          artist: track.artist,
          thumbnailUrl: track.thumbnailUrl || null,
        }
      : null,
    playing: player.playing,
    buffering: player.buffering,
    position: player.position,
    duration: player.duration,
    volume: player.volume,
    shuffle: player.shuffle,
    repeat: player.repeat,
    error: player.error,
    saved: libraryIdFor(useLibrary.getState(), track) !== null,
  };
}

let timer = null;
let lastSent = 0;

function publish() {
  if (timer) return;
  const wait = Math.max(0, MIN_INTERVAL_MS - (Date.now() - lastSent));
  timer = setTimeout(() => {
    timer = null;
    lastSent = Date.now();
    emitTo(SITE, 'music-now', snapshot());
  }, wait);
}

const ACTIONS = {
  sync: () => {},
  togglePlay: () => usePlayer.getState().togglePlay(),
  next: () => usePlayer.getState().next(),
  previous: () => usePlayer.getState().previous(),
  seek: (value) => usePlayer.getState().seek(Number(value) || 0),
  setVolume: (value) => usePlayer.getState().setVolume(Number(value)),
  toggleMute: () => usePlayer.getState().toggleMute(),
  toggleShuffle: () => usePlayer.getState().toggleShuffle(),
  cycleRepeat: () => usePlayer.getState().cycleRepeat(),
  toggleSaved: () => useLibrary.getState().toggle(usePlayer.getState().current()),
};

export function initRemote() {
  usePlayer.subscribe(publish);
  useLibrary.subscribe((state, previous) => state.ids !== previous.ids && publish());
  listen('music-remote', (payload) => {
    ACTIONS[payload?.action]?.(payload.value);
    publish();
  });
  publish();
}
