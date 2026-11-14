import Hls from 'hls.js';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ElasticSlider } from '../src/components/ElasticSlider';
import { Icon } from '../src/components/Icon';
import { formatTime } from '../src/lib/format';
import { invoke, listen } from '../src/lib/tauri';
import { films } from './api';
import { CinemaIcon } from './CinemaIcon';
import { useProgress } from './progress';

const HIDE_AFTER_MS = 2600;
const NEXT_COUNTDOWN = 8;
const VOLUME_KEY = 'whithin-cinema-volume';
const QUALITY_KEY = 'whithin-cinema-quality';

const readVolume = () => {
  const v = Number(localStorage.getItem(VOLUME_KEY));
  return Number.isFinite(v) && v >= 0 && v <= 1 && localStorage.getItem(VOLUME_KEY) !== null ? v : 1;
};

/** Best stream not above the remembered quality (or simply the best one). */
const preferredStream = (streams) => {
  const wanted = Number(localStorage.getItem(QUALITY_KEY)) || 0;
  if (!wanted) return streams[0];
  return streams.find((s) => s.height <= wanted) || streams[streams.length - 1];
};

async function resolve(session, ep) {
  if (session.title.source === 'anime') return { streams: ep.streams, subtitles: [] };
  return films.stream({
    postId: session.title.postId,
    translator: session.translator,
    season: ep.season,
    episode: ep.episode,
    movie: session.title.kind === 'movie',
  });
}

function Menu({ label, value, options, onSelect, icon }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return undefined;
    const close = () => setOpen(false);
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, [open]);
  return (
    <div className="vp-menu" onPointerDown={(e) => e.stopPropagation()}>
      <button type="button" className="vp-btn vp-btn--text" onClick={() => setOpen((v) => !v)} title={label}>
        {icon}
        <span>{options.find((o) => o.value === value)?.short ?? options.find((o) => o.value === value)?.label ?? label}</span>
      </button>
      {open && (
        <div className="vp-menu__list" role="menu">
          <div className="vp-menu__title">{label}</div>
          {options.map((o) => (
            <button
              key={String(o.value)}
              type="button"
              role="menuitemradio"
              aria-checked={o.value === value}
              className={`vp-menu__item${o.value === value ? ' vp-menu__item--on' : ''}`}
              onClick={() => {
                setOpen(false);
                onSelect(o.value);
              }}
            >
              {o.label}
              {o.value === value && <Icon name="check" size={16} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * The app's own video player (no site players): HLS through hls.js, progressive files natively, both fed
 * through the `whithin-cinema` proxy. Saves progress per episode and rolls on to the next one.
 */
export function VideoPlayer({ session, onClose }) {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const rootRef = useRef(null);
  const hideTimer = useRef(0);
  const saveRef = useRef(() => {});
  const resumeRef = useRef(session.resume || 0);

  const [index, setIndex] = useState(session.index);
  const [source, setSource] = useState(null);
  const [stream, setStream] = useState(null);
  const [subtitle, setSubtitle] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(readVolume);
  const [muted, setMuted] = useState(false);
  const [controls, setControls] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [countdown, setCountdown] = useState(null);

  const ep = session.episodes[index];
  const hasNext = index < session.episodes.length - 1;
  const hasPrev = index > 0;
  const save = useProgress((s) => s.save);

  // Resolve stream links for the current episode.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setSource(null);
    setCountdown(null);
    resolve(session, ep)
      .then((res) => {
        if (cancelled) return;
        if (!res.streams?.length) throw new Error('Нет доступных потоков');
        setSource(res);
        setStream(preferredStream(res.streams));
        setSubtitle(null);
      })
      .catch((e) => !cancelled && (setError(String(e?.message || e)), setLoading(false)));
    return () => {
      cancelled = true;
    };
  }, [session, ep]);

  // Attach the chosen stream; keeps the position when only the quality changes.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !stream) return undefined;
    const startAt = resumeRef.current;
    resumeRef.current = 0;
    hlsRef.current?.destroy();
    hlsRef.current = null;
    setLoading(true);
    if (stream.kind === 'hls' && Hls.isSupported()) {
      const hls = new Hls({ maxBufferLength: 60, startPosition: startAt || -1 });
      hlsRef.current = hls;
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (!data.fatal) return;
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) hls.startLoad();
        else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) hls.recoverMediaError();
        else setError('Не удалось воспроизвести видео');
      });
      hls.loadSource(stream.url);
      hls.attachMedia(video);
    } else {
      video.src = stream.url;
      if (startAt) video.currentTime = startAt;
    }
    video.play().catch(() => {});
    return () => {
      hlsRef.current?.destroy();
      hlsRef.current = null;
    };
  }, [stream]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = volume;
    video.muted = muted;
    localStorage.setItem(VOLUME_KEY, String(volume));
  }, [volume, muted]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    [...video.textTracks].forEach((track, i) => {
      track.mode = source?.subtitles?.[i]?.url === subtitle ? 'showing' : 'disabled';
    });
  }, [subtitle, source]);

  saveRef.current = () => {
    const video = videoRef.current;
    if (!video || !video.duration || !Number.isFinite(video.duration)) return;
    save(session.title, {
      season: ep.season,
      episode: ep.episode,
      episodeName: session.title.kind === 'movie' ? null : ep.name,
      translator: session.translator?.id ?? null,
      position: video.currentTime,
      duration: video.duration,
    });
  };

  useEffect(() => {
    const timer = setInterval(() => saveRef.current(), 5000);
    return () => {
      clearInterval(timer);
      saveRef.current();
    };
  }, []);

  const goTo = useCallback(
    (next) => {
      saveRef.current();
      resumeRef.current = 0;
      setIndex(next);
    },
    [],
  );

  // Countdown to the next episode after the current one ends.
  useEffect(() => {
    if (countdown === null) return undefined;
    if (countdown <= 0) {
      goTo(index + 1);
      return undefined;
    }
    const t = setTimeout(() => setCountdown((c) => (c === null ? null : c - 1)), 1000);
    return () => clearTimeout(t);
  }, [countdown, goTo, index]);

  const poke = useCallback(() => {
    setControls(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      if (!videoRef.current?.paused) setControls(false);
    }, HIDE_AFTER_MS);
  }, []);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) video.play().catch(() => {});
    else video.pause();
    poke();
  }, [poke]);

  const seekBy = useCallback(
    (delta) => {
      const video = videoRef.current;
      if (!video || !video.duration) return;
      video.currentTime = Math.max(0, Math.min(video.duration - 0.5, video.currentTime + delta));
      poke();
    },
    [poke],
  );

  const toggleFullscreen = useCallback(async () => {
    const next = !fullscreen;
    setFullscreen(next);
    await invoke('cinema_fullscreen', { on: next }).catch(() => {});
  }, [fullscreen]);

  const close = useCallback(() => {
    saveRef.current();
    if (fullscreen) invoke('cinema_fullscreen', { on: false }).catch(() => {});
    onClose();
  }, [fullscreen, onClose]);

  useEffect(() => {
    const onKey = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;
      const key = e.key.toLowerCase();
      if (key === ' ' || key === 'k' || key === 'л') togglePlay();
      else if (e.key === 'ArrowLeft' || key === 'j' || key === 'о') seekBy(e.shiftKey ? -30 : -10);
      else if (e.key === 'ArrowRight' || key === 'l' || key === 'д') seekBy(e.shiftKey ? 30 : 10);
      else if (e.key === 'ArrowUp') setVolume((v) => Math.min(1, v + 0.05));
      else if (e.key === 'ArrowDown') setVolume((v) => Math.max(0, v - 0.05));
      else if (key === 'f' || key === 'а') toggleFullscreen();
      else if (key === 'm' || key === 'ь') setMuted((m) => !m);
      else if (key === 'n' || key === 'т') hasNext && goTo(index + 1);
      else if (e.key === 'Escape') {
        if (fullscreen) toggleFullscreen();
        else close();
      } else return;
      e.preventDefault();
      poke();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [togglePlay, seekBy, toggleFullscreen, close, fullscreen, hasNext, goTo, index, poke]);

  useEffect(() => () => clearTimeout(hideTimer.current), []);

  // Switching to the messenger or music hides the tab (and leaves fullscreen) but would keep playing.
  useEffect(() => {
    const off = listen('cinema-visibility', (visible) => {
      if (visible) return;
      videoRef.current?.pause();
      setFullscreen(false);
      saveRef.current();
    });
    return () => {
      off.then((fn) => fn()).catch(() => {});
    };
  }, []);

  const inOpening = ep.opening && time >= ep.opening.start && time < ep.opening.stop - 1;
  const inEnding = ep.ending && hasNext && time >= ep.ending.start && time < ep.ending.stop - 1;
  const showControls = controls || !playing || Boolean(error);

  const subtitleOptions = [{ value: null, label: 'Выключены', short: 'Выкл' }, ...(source?.subtitles || []).map((s) => ({ value: s.url, label: s.label, short: s.label }))];

  return (
    <div
      ref={rootRef}
      className={`vp${showControls ? '' : ' vp--idle'}${fullscreen ? ' vp--fullscreen' : ''}`}
      onPointerMove={poke}
      onPointerDown={poke}
    >
      <video
        ref={videoRef}
        className="vp__video"
        crossOrigin="anonymous"
        playsInline
        onClick={togglePlay}
        onDoubleClick={toggleFullscreen}
        onPlay={() => setPlaying(true)}
        onPause={() => {
          setPlaying(false);
          saveRef.current();
        }}
        onWaiting={() => setLoading(true)}
        onPlaying={() => setLoading(false)}
        onCanPlay={() => setLoading(false)}
        onTimeUpdate={(e) => {
          const v = e.currentTarget;
          setTime(v.currentTime);
          if (v.buffered.length) setBuffered(v.buffered.end(v.buffered.length - 1));
        }}
        onDurationChange={(e) => setDuration(Number.isFinite(e.currentTarget.duration) ? e.currentTarget.duration : 0)}
        onEnded={() => {
          saveRef.current();
          if (hasNext) setCountdown(NEXT_COUNTDOWN);
        }}
      >
        {(source?.subtitles || []).map((s) => (
          <track key={s.url} kind="subtitles" label={s.label} src={s.url} />
        ))}
      </video>

      {loading && !error && <div className="vp__spinner" aria-label="Загрузка" />}

      {error && (
        <div className="vp__error">
          <strong>Не получается включить видео</strong>
          <span>{error}</span>
          <div className="vp__error-actions">
            {session.title.source === 'rezka' && (
              <button type="button" className="pill-btn" onClick={() => films.openAccount()}>
                Войти в HDRezka
              </button>
            )}
            {hasNext && (
              <button type="button" className="pill-btn" onClick={() => goTo(index + 1)}>
                Следующая серия
              </button>
            )}
            <button type="button" className="pill-btn pill-btn--primary" onClick={close}>
              Назад
            </button>
          </div>
        </div>
      )}

      <div className="vp__top">
        <button type="button" className="vp-btn" onClick={close} title="Назад (Esc)">
          <Icon name="back" size={22} />
        </button>
        <div className="vp__heading">
          <strong>{session.title.title}</strong>
          {session.title.kind !== 'movie' && (
            <span>
              {session.title.source === 'rezka' && ep.season ? `Сезон ${ep.season} · ` : ''}
              {ep.name}
              {session.translator?.name ? ` · ${session.translator.name}` : ''}
            </span>
          )}
        </div>
      </div>

      {!playing && !loading && !error && (
        <button type="button" className="vp__big-play" onClick={togglePlay} title="Смотреть">
          <Icon name="play" size={40} />
        </button>
      )}

      {inOpening && (
        <button type="button" className="vp__skip" onClick={() => (videoRef.current.currentTime = ep.opening.stop)}>
          Пропустить опенинг
        </button>
      )}
      {inEnding && (
        <button type="button" className="vp__skip" onClick={() => goTo(index + 1)}>
          Следующая серия
        </button>
      )}

      {countdown !== null && hasNext && (
        <div className="vp__next">
          <span>Следующая серия через {countdown}</span>
          <strong>{session.episodes[index + 1].name}</strong>
          <div className="vp__next-actions">
            <button type="button" className="pill-btn" onClick={() => setCountdown(null)}>
              Отмена
            </button>
            <button type="button" className="pill-btn pill-btn--primary" onClick={() => goTo(index + 1)}>
              Смотреть
            </button>
          </div>
        </div>
      )}

      <div className="vp__bottom" onPointerDown={(e) => e.stopPropagation()}>
        <div className="vp__timeline">
          <div className="vp__buffered" style={{ width: duration ? `${Math.min(100, (buffered / duration) * 100)}%` : 0 }} />
          <ElasticSlider
            value={time}
            max={duration || 1}
            onChange={(v) => setTime(v)}
            onChangeEnd={(v) => {
              if (videoRef.current && duration) videoRef.current.currentTime = v;
            }}
            label="Перемотка"
            thickness={4}
            activeThickness={8}
            className="vp__seek"
          />
        </div>
        <div className="vp__bar">
          <button type="button" className="vp-btn" onClick={() => hasPrev && goTo(index - 1)} disabled={!hasPrev} title="Предыдущая серия">
            <Icon name="prev" size={20} />
          </button>
          <button type="button" className="vp-btn vp-btn--play" onClick={togglePlay} title={playing ? 'Пауза (K)' : 'Смотреть (K)'}>
            <Icon name={playing ? 'pause' : 'play'} size={24} />
          </button>
          <button type="button" className="vp-btn" onClick={() => hasNext && goTo(index + 1)} disabled={!hasNext} title="Следующая серия (N)">
            <Icon name="next" size={20} />
          </button>
          <button type="button" className="vp-btn" onClick={() => seekBy(-10)} title="Назад на 10 с (←)">
            <CinemaIcon name="back10" size={22} />
          </button>
          <button type="button" className="vp-btn" onClick={() => seekBy(10)} title="Вперёд на 10 с (→)">
            <CinemaIcon name="fwd10" size={22} />
          </button>
          <div className="vp__volume">
            <button type="button" className="vp-btn" onClick={() => setMuted((m) => !m)} title="Звук (M)">
              <Icon name={muted || volume === 0 ? 'mute' : 'volume'} size={20} />
            </button>
            <ElasticSlider
              value={muted ? 0 : volume}
              max={1}
              onChange={(v) => {
                setMuted(false);
                setVolume(v);
              }}
              label="Громкость"
              thickness={4}
              activeThickness={7}
              className="vp__volume-slider"
            />
          </div>
          <span className="vp__time">
            {formatTime(time)} <i>/ {duration ? formatTime(duration) : '—'}</i>
          </span>
          <div className="vp__spacer" />
          {source?.subtitles?.length > 0 && (
            <Menu label="Субтитры" value={subtitle} options={subtitleOptions} onSelect={setSubtitle} icon={<CinemaIcon name="cc" size={20} />} />
          )}
          {source?.streams?.length > 1 && (
            <Menu
              label="Качество"
              value={stream?.label}
              options={source.streams.map((s) => ({ value: s.label, label: s.label }))}
              onSelect={(label) => {
                const next = source.streams.find((s) => s.label === label);
                if (!next || next === stream) return;
                localStorage.setItem(QUALITY_KEY, String(next.height));
                resumeRef.current = videoRef.current?.currentTime || 0;
                setStream(next);
              }}
              icon={<CinemaIcon name="hd" size={20} />}
            />
          )}
          <button type="button" className="vp-btn" onClick={toggleFullscreen} title="Полный экран (F)">
            <CinemaIcon name={fullscreen ? 'unfull' : 'full'} size={22} />
          </button>
        </div>
      </div>
    </div>
  );
}
