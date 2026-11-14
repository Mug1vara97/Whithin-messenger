import { useMemo, useState } from 'react';
import { Icon } from './Icon';
import { PlayButton } from './PlayButton';
import { TrackTable } from './TrackTable';
import { formatTotal, pluralTracks } from '../lib/format';
import { useLibrary } from '../store/library';
import { usePlayer } from '../store/player';

const normalize = (text) => (text || '').toLocaleLowerCase('ru-RU').replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();

export function LibraryView({ onSearch }) {
  const accountTracks = useLibrary((s) => s.tracks);
  const localTracks = useLibrary((s) => s.localTracks);
  const localFolder = useLibrary((s) => s.localFolder);
  const openLocalFolder = useLibrary((s) => s.openLocalFolder);
  const loadLocal = useLibrary((s) => s.loadLocal);
  const username = useLibrary((s) => s.username);
  const downloaded = useLibrary((s) => s.downloaded);
  const bulk = useLibrary((s) => s.bulk);
  const downloadAll = useLibrary((s) => s.downloadAll);
  const stopDownloadAll = useLibrary((s) => s.stopDownloadAll);
  const source = usePlayer((s) => s.source);
  const playing = usePlayer((s) => s.playing);
  const shuffle = usePlayer((s) => s.shuffle);
  const playList = usePlayer((s) => s.playList);
  const togglePlay = usePlayer((s) => s.togglePlay);
  const toggleShuffle = usePlayer((s) => s.toggleShuffle);
  const [filter, setFilter] = useState('');

  const tracks = useMemo(() => [...accountTracks, ...localTracks], [accountTracks, localTracks]);
  const shown = useMemo(() => {
    const words = normalize(filter).split(' ').filter(Boolean);
    if (!words.length) return tracks;
    return tracks.filter((t) => {
      const text = normalize(`${t.title} ${t.artist}`);
      return words.every((w) => text.includes(w));
    });
  }, [tracks, filter]);

  const savedCount = useMemo(() => accountTracks.filter((t) => downloaded.has(t.videoId)).length, [accountTracks, downloaded]);
  const isActive = source === 'library';
  const onPlay = () => {
    if (isActive) togglePlay();
    else playList(shown, 0, { source: 'library', shuffle });
  };

  return (
    <div className="view">
      <header className="hero">
        <div className="hero__art">
          <Icon name="note" size={84} />
        </div>
        <div className="hero__info">
          <span className="hero__kind">Плейлист</span>
          <h1 className="hero__title">Моя музыка</h1>
          <span className="hero__meta">
            {username && <strong>{username}</strong>}
            {username && ' · '}
            {pluralTracks(tracks.length)}
            {accountTracks.length > 0 && `, ${formatTotal(accountTracks)}`}
            {localTracks.length > 0 && ` · в аккаунте ${accountTracks.length}, файлов на компьютере ${localTracks.length}`}
            {savedCount > 0 && ` · скачано ${savedCount}`}
          </span>
        </div>
      </header>

      <div className="view__body">
        <div className="action-bar">
          <PlayButton playing={isActive && playing} onClick={onPlay} />
          <button
            type="button"
            className={`icon-btn icon-btn--lg${shuffle ? ' icon-btn--on' : ''}`}
            onClick={toggleShuffle}
            title="Перемешать"
          >
            <Icon name="shuffle" size={28} />
          </button>
          <button
            type="button"
            className="pill-btn pill-btn--ghost"
            onClick={openLocalFolder}
            title={localFolder ? `Положите сюда свои mp3, m4a, flac, ogg или wav: ${localFolder}` : 'Папка для своих файлов'}
          >
            Открыть папку с файлами
          </button>
          {bulk ? (
            <button type="button" className="pill-btn pill-btn--ghost" onClick={stopDownloadAll} title="Остановить скачивание">
              Скачано {bulk.done} из {bulk.total}
              {bulk.failed > 0 && `, не удалось ${bulk.failed}`} · Стоп
            </button>
          ) : (
            savedCount < accountTracks.length && (
              <button
                type="button"
                className="pill-btn pill-btn--ghost"
                onClick={downloadAll}
                title="Скачать все треки аккаунта на компьютер, чтобы они играли без интернета"
              >
                Скачать все ({accountTracks.length - savedCount})
              </button>
            )
          )}
          <button type="button" className="icon-btn" onClick={loadLocal} title="Обновить список файлов">
            <Icon name="refresh" size={20} />
          </button>
          {tracks.length > 0 && (
            <label className="search-input search-input--compact">
              <Icon name="search" size={18} />
              <input
                type="text"
                value={filter}
                placeholder="Поиск в «Моей музыке»"
                spellCheck={false}
                onChange={(e) => setFilter(e.target.value)}
                onKeyDown={(e) => e.key === 'Escape' && setFilter('')}
              />
              {filter && (
                <button type="button" className="search-input__clear" onClick={() => setFilter('')} title="Очистить">
                  <Icon name="close" size={18} />
                </button>
              )}
            </label>
          )}
        </div>

        {tracks.length ? (
          shown.length ? (
            <TrackTable tracks={shown} source="library" />
          ) : (
            <div className="empty">
              <Icon name="search" size={56} />
              <h2>Ничего не найдено</h2>
              <p>В «Моей музыке» нет треков по запросу «{filter.trim()}».</p>
            </div>
          )
        ) : (
          <div className="empty">
            <Icon name="library" size={56} />
            <h2>Здесь будут ваши любимые треки</h2>
            <p>Сохраняйте песни, нажимая на «+», или положите свои файлы в папку.</p>
            <button type="button" className="pill-btn" onClick={onSearch}>
              Найти песни
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
