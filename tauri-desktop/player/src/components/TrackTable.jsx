import { ArtistLink } from './Cards';
import { Cover } from './Cover';
import { Equalizer } from './Equalizer';
import { Icon } from './Icon';
import { formatTime } from '../lib/format';
import { isLocalFile, libraryIdFor, useLibrary } from '../store/library';
import { usePlayer } from '../store/player';

/** `queue` is what gets played (defaults to `tracks`); `tracks` must be its prefix. */
export function TrackTable({ tracks, queue = tracks, source, startIndex = 0, showHeader = true }) {
  const library = useLibrary();
  const toggle = useLibrary((s) => s.toggle);
  const currentId = usePlayer((s) => s.queue[s.index]?.videoId);
  const playing = usePlayer((s) => s.playing);
  const playList = usePlayer((s) => s.playList);
  const togglePlay = usePlayer((s) => s.togglePlay);

  const onRowPlay = (index) => {
    if (tracks[index].videoId === currentId) togglePlay();
    else playList(queue, index, { source });
  };

  return (
    <div className="tracks" role="table">
      {showHeader && (
        <div className="tracks__head" role="row">
          <span className="tracks__num">#</span>
          <span>Название</span>
          <span />
          <span className="tracks__time">
            <Icon name="clock" size={16} />
          </span>
        </div>
      )}
      {tracks.map((track, i) => {
        const isCurrent = track.videoId === currentId;
        const owned = libraryIdFor(library, track) !== null;
        return (
          <div
            key={`${track.videoId}-${i}`}
            className={`track${isCurrent ? ' track--current' : ''}`}
            role="row"
            onDoubleClick={() => onRowPlay(i)}
          >
            <span className="tracks__num">
              <span className="track__index">
                {isCurrent ? <Equalizer paused={!playing} /> : startIndex + i + 1}
              </span>
              <button type="button" className="track__play" onClick={() => onRowPlay(i)} title="Слушать">
                <Icon name={isCurrent && playing ? 'pause' : 'play'} size={16} />
              </button>
            </span>
            <span className="track__main">
              <Cover track={track} size={40} />
              <span className="track__meta">
                <span className="track__title" title={track.title}>
                  {track.title}
                  {track.source && <span className="track__source">{track.source}</span>}
                </span>
                <ArtistLink track={track} className="track__artist" />
              </span>
            </span>
            <span className="track__save-cell">
              {owned && !isLocalFile(track) && (
                <button
                  type="button"
                  className={`track__save${library.downloaded.has(track.videoId) ? ' track__save--on' : ''}${
                    library.downloading.has(track.videoId) ? ' icon-btn--spin' : ''
                  }`}
                  disabled={library.downloading.has(track.videoId)}
                  onClick={() =>
                    library.downloaded.has(track.videoId) ? library.deleteDownload(track) : library.download(track)
                  }
                  title={
                    library.downloading.has(track.videoId)
                      ? 'Скачивается…'
                      : library.downloaded.has(track.videoId)
                        ? 'Скачано на компьютер. Нажмите, чтобы удалить файл'
                        : 'Скачать на компьютер'
                  }
                >
                  <Icon
                    name={library.downloading.has(track.videoId) ? 'refresh' : library.downloaded.has(track.videoId) ? 'downloaded' : 'download'}
                    size={18}
                  />
                </button>
              )}
              {!isLocalFile(track) && (
              <button
                type="button"
                className={`track__save${owned ? ' track__save--on' : ''}`}
                onClick={() => toggle(track)}
                title={owned ? 'Убрать из «Моей музыки»' : 'Добавить в «Мою музыку»'}
              >
                <Icon name={owned ? 'check' : 'plus'} size={18} />
              </button>
              )}
            </span>
            <span className="tracks__time">{track.durationSeconds ? formatTime(track.durationSeconds) : ''}</span>
          </div>
        );
      })}
    </div>
  );
}
