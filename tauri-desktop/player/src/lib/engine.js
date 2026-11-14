import { invoke, listen } from './tauri';

/**
 * Sound is produced by a separate audio process (see `music_audio.rs`), so screen sharing
 * with system audio picks the music up. Every load gets a token; events of older loads are
 * dropped by the subscriber.
 */
let token = 0;
const subscribers = new Set();

const dispatch = (event) => subscribers.forEach((fn) => fn(event));

listen('music-audio', dispatch);

const command = (payload) => invoke('music_audio_command', { command: payload }).catch(() => {});

export const engine = {
  load(videoId, { start = 0, play = true, volume = 1, fresh = false } = {}) {
    token += 1;
    const current = token;
    invoke('music_audio_load', { request: { token: current, videoId, start, play, volume, fresh } }).catch((error) =>
      dispatch({ event: 'error', token: current, message: String(error) }),
    );
    return current;
  },
  play: () => command({ cmd: 'play' }),
  pause: () => command({ cmd: 'pause' }),
  stop: () => command({ cmd: 'stop' }),
  seek: (position) => command({ cmd: 'seek', position }),
  setVolume: (value) => command({ cmd: 'volume', value }),
  subscribe(fn) {
    subscribers.add(fn);
    return () => subscribers.delete(fn);
  },
};

/**
 * Windows media keys / the system media overlay only talk to a page that is playing media,
 * so a silent looping clip mirrors the play state for `navigator.mediaSession`.
 */
function silentWav(seconds = 1, rate = 8000) {
  const samples = seconds * rate;
  const buffer = new ArrayBuffer(44 + samples);
  const view = new DataView(buffer);
  const text = (offset, value) => [...value].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));
  text(0, 'RIFF');
  view.setUint32(4, 36 + samples, true);
  text(8, 'WAVE');
  text(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate, true);
  view.setUint16(32, 1, true);
  view.setUint16(34, 8, true);
  text(36, 'data');
  view.setUint32(40, samples, true);
  new Uint8Array(buffer, 44).fill(128);
  return URL.createObjectURL(new Blob([buffer], { type: 'audio/wav' }));
}

const keepAlive = new Audio(silentWav());
keepAlive.loop = true;

export const mediaKeys = {
  setPlaying(playing) {
    if (playing) keepAlive.play().catch(() => {});
    else keepAlive.pause();
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = playing ? 'playing' : 'paused';
  },
  setTrack(track) {
    if (!('mediaSession' in navigator) || !track) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title,
      artist: track.artist,
      artwork: track.thumbnailUrl ? [{ src: track.thumbnailUrl, sizes: '544x544' }] : [],
    });
  },
  bind(actions) {
    if (!('mediaSession' in navigator)) return;
    Object.entries(actions).forEach(([action, handler]) => {
      try {
        navigator.mediaSession.setActionHandler(action, handler);
      } catch {
        /* unsupported action */
      }
    });
  },
};
