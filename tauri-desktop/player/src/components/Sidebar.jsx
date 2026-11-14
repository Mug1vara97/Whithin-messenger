import { useMemo } from 'react';
import { Cover } from './Cover';
import { Equalizer } from './Equalizer';
import { Icon } from './Icon';
import { pluralTracks } from '../lib/format';
import { useLibrary } from '../store/library';
import { usePlayer } from '../store/player';

const NAV = [
  { id: 'home', label: 'Главная', icon: 'home' },
  { id: 'library', label: 'Моя музыка', icon: 'library' },
];

export function Sidebar({ view, onNavigate }) {
  const accountTracks = useLibrary((s) => s.tracks);
  const localTracks = useLibrary((s) => s.localTracks);
  const tracks = useMemo(() => [...accountTracks, ...localTracks], [accountTracks, localTracks]);
  const signedIn = useLibrary((s) => s.signedIn);
  const online = useLibrary((s) => s.online);
  const pending = useLibrary((s) => s.pending);
  const currentId = usePlayer((s) => s.queue[s.index]?.videoId);
  const playing = usePlayer((s) => s.playing);
  const playList = usePlayer((s) => s.playList);

  let status = null;
  if (!signedIn) status = 'Войдите в Whithin, чтобы «Моя музыка» синхронизировалась';
  else if (!online) status = pending ? `Нет связи с сервером · ждут отправки: ${pending}` : 'Нет связи с сервером';

  return (
    <aside className="sidebar">
      <nav className="panel sidebar__nav">
        {NAV.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`nav-item${view === item.id ? ' nav-item--active' : ''}`}
            onClick={() => onNavigate(item.id)}
          >
            <Icon name={item.icon} size={22} />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <section className="panel sidebar__library">
        <button type="button" className="sidebar__library-title" onClick={() => onNavigate('library')}>
          <Icon name="library" size={22} />
          <span>Медиатека</span>
        </button>

        <div className="sidebar__list">
          <button
            type="button"
            className={`lib-item${view === 'library' ? ' lib-item--active' : ''}`}
            onClick={() => onNavigate('library')}
          >
            <span className="lib-item__art lib-item__art--liked">
              <Icon name="note" size={20} />
            </span>
            <span className="lib-item__meta">
              <span className="lib-item__title">Моя музыка</span>
              <span className="lib-item__sub">Плейлист · {pluralTracks(tracks.length)}</span>
            </span>
          </button>

          {tracks.map((track, i) => (
            <button
              key={track.videoId}
              type="button"
              className={`lib-item${track.videoId === currentId ? ' lib-item--playing' : ''}`}
              onClick={() => playList(tracks, i, { source: 'library' })}
              title={`${track.title} — ${track.artist}`}
            >
              <Cover track={track} size={44} />
              <span className="lib-item__meta">
                <span className="lib-item__title">{track.title}</span>
                <span className="lib-item__sub">{track.artist}</span>
              </span>
              {track.videoId === currentId && <Equalizer paused={!playing} />}
            </button>
          ))}
        </div>

        {status && (
          <div className="sidebar__status">
            <Icon name="cloudOff" size={16} />
            <span>{status}</span>
          </div>
        )}
      </section>
    </aside>
  );
}
