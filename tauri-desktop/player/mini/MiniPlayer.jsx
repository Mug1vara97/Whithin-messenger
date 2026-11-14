import { useEffect, useState } from 'react';
import { ElasticSlider } from '../src/components/ElasticSlider';
import { Icon } from '../src/components/Icon';
import { formatTime } from '../src/lib/format';
import { imageSrc, retryDirect } from '../src/lib/image';
import { emitTo, invoke, listen } from '../src/lib/tauri';

const PLAYER = { kind: 'Webview', label: 'music' };
const send = (action, value) => emitTo(PLAYER, 'music-remote', { action, value });

function Cover({ url }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [url]);
  return (
    <div className="mini__cover" data-tauri-drag-region>
      {url && !broken ? (
        <img
          key={url}
          src={imageSrc(url, 80)}
          alt=""
          referrerPolicy="no-referrer"
          draggable={false}
          onError={(e) => retryDirect(e, url) || setBroken(true)}
        />
      ) : (
        <Icon name="note" size={26} />
      )}
    </div>
  );
}

const ExpandIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <path d="M14 4h6v6M20 4l-7 7M10 20H4v-6M4 20l7-7" />
  </svg>
);

/** Always-on-top window mirroring the player; commands go back over `music-remote`. */
export function MiniPlayer() {
  const [now, setNow] = useState(null);

  useEffect(() => {
    const offs = [listen('music-now', setNow)];
    send('sync');
    return () => offs.forEach((off) => off.then((fn) => fn()));
  }, []);

  const track = now?.track;
  const duration = now?.duration || 0;
  const position = duration ? Math.min(now.position, duration) : 0;
  const hide = () => invoke('mini_player_show', { visible: false }).catch(() => {});
  const openFull = () => invoke('mini_player_open_full').catch(() => {});

  return (
    <div className={`mini${now?.playing ? ' mini--playing' : ''}`} data-tauri-drag-region>
      {track?.thumbnailUrl && (
        <div className="mini__backdrop" style={{ backgroundImage: `url("${imageSrc(track.thumbnailUrl, 80)}")` }} />
      )}

      <div className="mini__window">
        <button type="button" className="mini__chip" onClick={openFull} title="Открыть плеер">
          <ExpandIcon />
        </button>
        <button type="button" className="mini__chip" onClick={hide} title="Скрыть мини-плеер">
          <Icon name="close" size={13} />
        </button>
      </div>

      <Cover url={track?.thumbnailUrl} />

      <div className="mini__body" data-tauri-drag-region>
        <div className="mini__meta" data-tauri-drag-region>
          <strong title={track?.title} data-tauri-drag-region>{track?.title || 'Ничего не играет'}</strong>
          <span title={track?.artist} data-tauri-drag-region>
            {track ? now.error || track.artist : 'Включите музыку в плеере Whithin'}
          </span>
        </div>

        <div className="mini__controls" data-tauri-drag-region>
          <button type="button" className="mini__icon" onClick={() => send('previous')} disabled={!track} title="Предыдущий">
            <Icon name="prev" size={16} />
          </button>
          <button
            type="button"
            className="mini__play"
            onClick={track ? () => send('togglePlay') : openFull}
            title={now?.playing ? 'Пауза' : 'Слушать'}
          >
            <Icon name={now?.playing ? 'pause' : 'play'} size={16} />
          </button>
          <button type="button" className="mini__icon" onClick={() => send('next')} disabled={!track} title="Следующий">
            <Icon name="next" size={16} />
          </button>
          <button
            type="button"
            className={`mini__icon${now?.saved ? ' mini__icon--on' : ''}`}
            onClick={() => send('toggleSaved')}
            disabled={!track}
            title={now?.saved ? 'Убрать из «Моей музыки»' : 'Добавить в «Мою музыку»'}
          >
            <Icon name={now?.saved ? 'check' : 'plus'} size={16} />
          </button>
          {track && (
            <span className="mini__time" data-tauri-drag-region>
              {formatTime(position)}
              <i> / {duration ? formatTime(duration) : '—'}</i>
            </span>
          )}
        </div>
      </div>

      <ElasticSlider
        value={position}
        max={duration || 1}
        onChangeEnd={(value) => duration && send('seek', value)}
        label="Позиция"
        thickness={3}
        activeThickness={5}
        className="mini__seek"
      />
    </div>
  );
}
