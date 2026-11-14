import { Cover } from './Cover';
import { Equalizer } from './Equalizer';
import { Icon } from './Icon';
import { usePlayer } from '../store/player';

function QueueItem({ track, active, playing, onPlay }) {
  return (
    <button type="button" className={`queue-item${active ? ' queue-item--active' : ''}`} onClick={onPlay}>
      <Cover track={track} size={44} />
      <span className="queue-item__meta">
        <span className="queue-item__title">{track.title}</span>
        <span className="queue-item__sub">{track.artist}</span>
      </span>
      {active && <Equalizer paused={!playing} />}
    </button>
  );
}

export function QueuePanel({ onClose }) {
  const queue = usePlayer((s) => s.queue);
  const index = usePlayer((s) => s.index);
  const playing = usePlayer((s) => s.playing);
  const jumpTo = usePlayer((s) => s.jumpTo);
  const current = index >= 0 ? queue[index] : null;
  const upcoming = queue.slice(index + 1);

  return (
    <aside className="panel queue">
      <header className="queue__head">
        <span>Очередь</span>
        <button type="button" className="icon-btn" onClick={onClose} title="Закрыть">
          <Icon name="close" size={18} />
        </button>
      </header>
      <div className="queue__body">
        {current ? (
          <>
            <h3 className="queue__label">Сейчас играет</h3>
            <QueueItem track={current} active playing={playing} onPlay={() => {}} />
            {upcoming.length > 0 && <h3 className="queue__label">Далее</h3>}
            {upcoming.map((track, i) => (
              <QueueItem key={`${track.videoId}-${i}`} track={track} onPlay={() => jumpTo(index + 1 + i)} />
            ))}
          </>
        ) : (
          <div className="queue__empty">Очередь пуста</div>
        )}
      </div>
    </aside>
  );
}
