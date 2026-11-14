import { Icon } from './Icon';

export function PlayButton({ playing, onClick, size = 56, title }) {
  return (
    <button
      type="button"
      className="play-fab"
      style={{ width: size, height: size }}
      onClick={onClick}
      title={title || (playing ? 'Пауза' : 'Слушать')}
    >
      <Icon name={playing ? 'pause' : 'play'} size={Math.round(size * 0.42)} />
    </button>
  );
}
