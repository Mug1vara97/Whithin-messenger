import { ArtistLink } from './Cards';
import { Cover } from './Cover';
import { ElasticSlider } from './ElasticSlider';
import { Icon } from './Icon';
import { Slider } from './Slider';
import { formatTime } from '../lib/format';
import { libraryIdFor, useLibrary } from '../store/library';
import { usePlayer } from '../store/player';

const REPEAT_TITLE = { off: 'Включить повтор', all: 'Повтор трека', one: 'Выключить повтор' };

export function NowPlayingBar({ queueOpen, onToggleQueue }) {
  const track = usePlayer((s) => s.queue[s.index] || null);
  const playing = usePlayer((s) => s.playing);
  const buffering = usePlayer((s) => s.buffering);
  const position = usePlayer((s) => s.position);
  const duration = usePlayer((s) => s.duration);
  const volume = usePlayer((s) => s.volume);
  const shuffle = usePlayer((s) => s.shuffle);
  const repeat = usePlayer((s) => s.repeat);
  const error = usePlayer((s) => s.error);
  const actions = usePlayer.getState();
  const owned = useLibrary((s) => libraryIdFor(s, track) !== null);
  const toggleSave = useLibrary((s) => s.toggle);

  return (
    <footer className={`now-bar${track ? '' : ' now-bar--empty'}`}>
      <div className="now-bar__track">
        {track && (
          <>
            <Cover track={track} size={56} />
            <div className="now-bar__meta">
              <span className="now-bar__title" title={track.title}>
                {track.title}
              </span>
              {error ? (
                <span className="now-bar__artist now-bar__artist--error">{error}</span>
              ) : (
                <ArtistLink track={track} className="now-bar__artist" />
              )}
            </div>
            <button
              type="button"
              className={`icon-btn${owned ? ' icon-btn--on' : ''}`}
              onClick={() => toggleSave(track)}
              title={owned ? 'Убрать из «Моей музыки»' : 'Добавить в «Мою музыку»'}
            >
              <Icon name={owned ? 'check' : 'plus'} size={18} />
            </button>
          </>
        )}
      </div>

      <div className="now-bar__center">
        <div className="now-bar__controls">
          <button
            type="button"
            className={`icon-btn${shuffle ? ' icon-btn--on icon-btn--dot' : ''}`}
            onClick={actions.toggleShuffle}
            title="Перемешать"
          >
            <Icon name="shuffle" size={18} />
          </button>
          <button type="button" className="icon-btn" onClick={actions.previous} title="Назад">
            <Icon name="prev" size={18} />
          </button>
          <button
            type="button"
            className={`now-bar__play${buffering && playing ? ' now-bar__play--busy' : ''}`}
            onClick={actions.togglePlay}
            title={playing ? 'Пауза' : 'Слушать'}
          >
            <Icon name={playing ? 'pause' : 'play'} size={18} />
          </button>
          <button type="button" className="icon-btn" onClick={() => actions.next()} title="Далее">
            <Icon name="next" size={18} />
          </button>
          <button
            type="button"
            className={`icon-btn icon-btn--repeat${repeat !== 'off' ? ' icon-btn--on icon-btn--dot' : ''}`}
            onClick={actions.cycleRepeat}
            title={REPEAT_TITLE[repeat]}
          >
            <Icon name="repeat" size={18} />
            {repeat === 'one' && <span className="repeat-one">1</span>}
          </button>
        </div>
        <div className="now-bar__progress">
          <span>{formatTime(position)}</span>
          <Slider value={position} max={duration} onCommit={actions.seek} label="Позиция" />
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      <div className="now-bar__extra">
        <button
          type="button"
          className={`icon-btn${queueOpen ? ' icon-btn--on icon-btn--dot' : ''}`}
          onClick={onToggleQueue}
          title="Очередь"
        >
          <Icon name="queue" size={18} />
        </button>
        <button type="button" className="icon-btn" onClick={actions.toggleMute} title={volume > 0 ? 'Без звука' : 'Включить звук'}>
          <Icon name={volume > 0 ? 'volume' : 'mute'} size={18} />
        </button>
        <ElasticSlider value={volume} onChange={actions.setVolume} className="es--volume" label="Громкость" thickness={4} activeThickness={8} />
      </div>
    </footer>
  );
}
