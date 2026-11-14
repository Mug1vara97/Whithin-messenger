import { useEffect, useRef } from 'react';
import { ArtistCard, ArtistLink, Shelf } from './Cards';
import { Cover } from './Cover';
import { Icon } from './Icon';
import { imageSrc, retryDirect } from '../lib/image';
import { PlayButton } from './PlayButton';
import { SearchField } from './SearchField';
import { TrackTable } from './TrackTable';
import { openArtist } from '../store/nav';
import { useSearch } from '../store/search';
import { usePlayer } from '../store/player';

const TABS = [
  { id: 'all', label: 'Все' },
  { id: 'tracks', label: 'Треки' },
  { id: 'artists', label: 'Исполнители' },
];

const normalize = (text) => text.toLocaleLowerCase('ru-RU').replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();

function TopArtist({ artist }) {
  return (
    <div className="top-card" role="button" tabIndex={0} onClick={() => openArtist(artist.id)}>
      <div className="cover cover--round" style={{ width: 96, height: 96 }}>
        {artist.imageUrl ? (
          <img
            key={artist.imageUrl}
            src={imageSrc(artist.imageUrl, 96)}
            alt=""
            referrerPolicy="no-referrer"
            onError={(e) => retryDirect(e, artist.imageUrl)}
          />
        ) : (
          <Icon name="person" size={40} />
        )}
      </div>
      <div className="top-card__title" title={artist.name}>
        {artist.name}
      </div>
      <div className="top-card__sub">
        <span className="badge">Исполнитель</span>
      </div>
    </div>
  );
}

function TopTrack({ track, results }) {
  const currentId = usePlayer((s) => s.queue[s.index]?.videoId);
  const playing = usePlayer((s) => s.playing);
  const isCurrent = track.videoId === currentId;
  const play = () => (isCurrent ? usePlayer.getState().togglePlay() : usePlayer.getState().playList(results, 0, { source: 'search' }));
  return (
    <div className="top-card" onDoubleClick={play}>
      <Cover track={track} size={96} className="cover--rounded" />
      <div className="top-card__title" title={track.title}>
        {track.title}
      </div>
      <div className="top-card__sub">
        <span className="badge">Трек</span>
        <ArtistLink track={track} />
      </div>
      <div className="top-card__play">
        <PlayButton size={48} playing={isCurrent && playing} onClick={play} />
      </div>
    </div>
  );
}

export function SearchView({ scrollRef }) {
  const query = useSearch((s) => s.query);
  const tab = useSearch((s) => s.tab);
  const results = useSearch((s) => s.results);
  const artists = useSearch((s) => s.artists);
  const searching = useSearch((s) => s.searching);
  const searched = useSearch((s) => s.searched);
  const error = useSearch((s) => s.error);
  const hasMore = useSearch((s) => s.hasMore);
  const setTab = useSearch((s) => s.setTab);
  const more = useSearch((s) => s.more);
  const sentinelRef = useRef(null);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !hasMore || tab !== 'tracks') return undefined;
    const observer = new IntersectionObserver((entries) => entries[0].isIntersecting && more(), {
      root: scrollRef.current,
      rootMargin: '400px',
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, more, results.length, scrollRef, tab]);

  const trimmed = query.trim();
  const hasQuery = trimmed.length >= 2;
  const nothing = !results.length && !artists.length;
  const exactArtist = artists[0] && normalize(artists[0].name) === normalize(trimmed) ? artists[0] : null;

  return (
    <div className="view view--search">
      <div className="search-bar">
        <SearchField autoFocus />
        {hasQuery && !nothing && (
          <div className="chips">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`chip${tab === t.id ? ' chip--on' : ''}`}
                onClick={() => {
                  setTab(t.id);
                  scrollRef.current?.scrollTo({ top: 0 });
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="view__body">
        {!hasQuery && (
          <div className="empty">
            <Icon name="search" size={56} />
            <h2>Найдите любимую музыку</h2>
            <p>Введите название песни или имя исполнителя.</p>
          </div>
        )}

        {hasQuery && error && nothing && (
          <div className="empty empty--error">
            <h2>{error}</h2>
            <p>Проверьте подключение к интернету и попробуйте ещё раз.</p>
          </div>
        )}

        {hasQuery && !error && nothing && (
          <div className="empty">
            <h2>{searching || searched !== trimmed ? 'Ищем…' : `Ничего не найдено по запросу «${trimmed}»`}</h2>
          </div>
        )}

        {hasQuery && !nothing && tab === 'all' && (
          <>
            <div className="search-top">
              <section>
                <h2 className="section-title">Лучший результат</h2>
                {exactArtist || !results.length ? (
                  <TopArtist artist={exactArtist || artists[0]} />
                ) : (
                  <TopTrack track={results[0]} results={results} />
                )}
              </section>
              {results.length > 0 && (
                <section className="search-top__tracks">
                  <div className="shelf__head">
                    <h2 className="section-title">Треки</h2>
                    {results.length > 4 && (
                      <button type="button" className="text-btn" onClick={() => setTab('tracks')}>
                        Показать все
                      </button>
                    )}
                  </div>
                  <TrackTable tracks={results.slice(0, 4)} queue={results} source="search" showHeader={false} />
                </section>
              )}
            </div>

            {artists.length > 0 && (
              <Shelf
                title="Исполнители"
                action={
                  artists.length > 6 && (
                    <button type="button" className="text-btn" onClick={() => setTab('artists')}>
                      Показать все
                    </button>
                  )
                }
              >
                {artists.slice(0, 10).map((artist) => (
                  <ArtistCard key={artist.id} artist={artist} />
                ))}
              </Shelf>
            )}
          </>
        )}

        {hasQuery && tab === 'tracks' && results.length > 0 && (
          <>
            <TrackTable tracks={results} source="search" />
            {hasMore && (
              <div ref={sentinelRef} className="loading-more">
                Загрузка…
              </div>
            )}
          </>
        )}

        {hasQuery && tab === 'artists' && artists.length > 0 && (
          <div className="card-grid">
            {artists.map((artist) => (
              <ArtistCard key={artist.id} artist={artist} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
