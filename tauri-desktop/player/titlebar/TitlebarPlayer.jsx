import { useEffect, useRef, useState } from 'react';
import { ElasticSlider } from '../src/components/ElasticSlider';
import { Icon } from '../src/components/Icon';
import { formatTime } from '../src/lib/format';
import { imageSrc, retryDirect } from '../src/lib/image';
import { StrokeIcon } from './icons';

const PLAYER = { kind: 'Webview', label: 'music' };

const send = (action, value) => window.__TAURI__.event.emitTo(PLAYER, 'music-remote', { action, value }).catch(() => {});

function Cover({ url, size, className = '' }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [url]);
  return (
    <span className={`tp-cover ${className}`} style={{ width: size, height: size }}>
      {url && !broken ? (
        <img
          key={url}
          src={imageSrc(url, size)}
          alt=""
          referrerPolicy="no-referrer"
          onError={(e) => retryDirect(e, url) || setBroken(true)}
        />
      ) : (
        <Icon name="note" size={size * 0.55} />
      )}
    </span>
  );
}

export function TitlebarPlayer() {
  const [now, setNow] = useState(null);
  const [playerOpen, setPlayerOpen] = useState(false);
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    const { listen } = window.__TAURI__.event;
    const offs = [
      listen('music-now', (e) => setNow(e.payload)),
      listen('music-visibility', (e) => setPlayerOpen(Boolean(e.payload))),
    ];
    send('sync');
    return () => offs.forEach((off) => off.then((fn) => fn()));
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (!e.composedPath().includes(rootRef.current)) setOpen(false);
    };
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const track = now?.track;
  const hasTrack = Boolean(track);
  useEffect(() => {
    if (!hasTrack || playerOpen) setOpen(false);
  }, [hasTrack, playerOpen]);

  if (!track || playerOpen) return null;

  const duration = now.duration || 0;
  const playIcon = now.playing ? 'pause' : 'play';

  return (
    <div className="tp" ref={rootRef}>
      <div className="tp-bar">
        <button type="button" className="tp-title" onClick={() => setOpen((v) => !v)} title="Открыть мини-плеер">
          <Cover url={track.thumbnailUrl} size={20} />
          <span className="tp-title__text">
            <b>{track.title}</b>
            <span> — {track.artist}</span>
          </span>
        </button>
        <button type="button" className="tp-btn" onClick={() => send('previous')} title="Предыдущий">
          <Icon name="prev" size={14} />
        </button>
        <button type="button" className="tp-btn tp-btn--main" onClick={() => send('togglePlay')} title={now.playing ? 'Пауза' : 'Слушать'}>
          <Icon name={playIcon} size={14} />
        </button>
        <button type="button" className="tp-btn" onClick={() => send('next')} title="Следующий">
          <Icon name="next" size={14} />
        </button>
      </div>

      {open && (
        <div className="esd-player" role="dialog" aria-label="Мини-плеер">
          <Cover url={track.thumbnailUrl} size={140} className="esd-player__art" />
          <div className="esd-player__meta">
            <strong title={track.title}>{track.title}</strong>
            <span title={track.artist}>{now.error || track.artist}</span>
          </div>
          <button
            type="button"
            className={`esd-icon-button esd-player__save${now.saved ? ' esd-icon-button--on' : ''}`}
            onClick={() => send('toggleSaved')}
            title={now.saved ? 'Убрать из «Моей музыки»' : 'Добавить в «Мою музыку»'}
          >
            <StrokeIcon name={now.saved ? 'check' : 'plus'} size={18} />
          </button>

          <div className="esd-player__seek">
            <ElasticSlider
              value={duration ? Math.min(now.position, duration) : 0}
              max={duration || 1}
              onChangeEnd={(value) => duration && send('seek', value)}
              label="Позиция"
              thickness={5}
              activeThickness={9}
            />
            <div className="esd-player__times">
              <span>{formatTime(now.position)}</span>
              <span>{duration ? `−${formatTime(Math.max(0, duration - now.position))}` : ''}</span>
            </div>
          </div>

          <div className="esd-player__transport">
            <button
              type="button"
              className={`esd-icon-button${now.shuffle ? ' esd-icon-button--on' : ''}`}
              onClick={() => send('toggleShuffle')}
              title={now.shuffle ? 'Выключить случайный порядок' : 'Случайный порядок'}
            >
              <StrokeIcon name="shuffle" size={18} />
            </button>
            <button type="button" className="esd-icon-button" onClick={() => send('previous')} title="Предыдущий">
              <StrokeIcon name="prev" size={20} />
            </button>
            <button
              type="button"
              className="esd-icon-button esd-icon-button--raised"
              onClick={() => send('togglePlay')}
              title={now.playing ? 'Пауза' : 'Слушать'}
            >
              <StrokeIcon name={playIcon} size={22} />
            </button>
            <button type="button" className="esd-icon-button" onClick={() => send('next')} title="Следующий">
              <StrokeIcon name="next" size={20} />
            </button>
            <button
              type="button"
              className={`esd-icon-button${now.repeat !== 'off' ? ' esd-icon-button--on' : ''}`}
              onClick={() => send('cycleRepeat')}
              title={now.repeat === 'one' ? 'Повтор трека' : now.repeat === 'all' ? 'Повтор очереди' : 'Повтор'}
            >
              <StrokeIcon name="repeat" size={18} />
              {now.repeat === 'one' && <span className="esd-repeat-one">1</span>}
            </button>
          </div>

          <div className="esd-player__volume">
            <button
              type="button"
              className="esd-volume-btn"
              onClick={() => send('toggleMute')}
              title={now.volume > 0 ? 'Без звука' : 'Включить звук'}
            >
              <StrokeIcon name={now.volume > 0 ? 'volumeHigh' : 'volumeMute'} size={18} />
            </button>
            <ElasticSlider
              value={now.volume}
              onChange={(value) => send('setVolume', value)}
              label="Громкость"
              thickness={5}
              activeThickness={9}
            />
          </div>
        </div>
      )}
    </div>
  );
}
