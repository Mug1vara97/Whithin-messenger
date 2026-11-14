import { useEffect, useState } from 'react';
import { ArtistCard, Shelf, TrackCard } from './Cards';
import { Icon } from './Icon';
import { TrackTable } from './TrackTable';
import { useForYou } from '../store/forYou';
import { useLibrary } from '../store/library';
import { usePlayer } from '../store/player';

const PREVIEW = 6;

/** Personal recommendations under «Поток», built from history and the library like on Android. */
export function ForYou() {
  const libraryLoaded = useLibrary((s) => s.loaded);
  const { mix, artists, shelves, loading, loaded } = useForYou();
  const source = usePlayer((s) => s.source);
  const playing = usePlayer((s) => s.playing);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (libraryLoaded) useForYou.getState().ensure();
  }, [libraryLoaded]);

  if (!loaded && !loading) return null;
  if (loaded && !loading && !mix.length) return null;

  const mixPlaying = source === 'forYou' && playing;
  const refresh = () => {
    setExpanded(false);
    useForYou.getState().refresh();
  };

  return (
    <>
      <section className="for-you">
        <div className="shelf__head">
          <div>
            <div className="shelf__sub">Подборка на основе ваших прослушиваний</div>
            <h2 className="section-title">Для вас</h2>
          </div>
          <div className="for-you__actions">
            <button
              type="button"
              className="pill-btn pill-btn--primary"
              disabled={!mix.length}
              onClick={() =>
                mixPlaying ? usePlayer.getState().togglePlay() : usePlayer.getState().playList(mix, 0, { source: 'forYou' })
              }
            >
              <Icon name={mixPlaying ? 'pause' : 'play'} size={18} />
              {mixPlaying ? 'Пауза' : 'Слушать'}
            </button>
            <button
              type="button"
              className="outline-btn"
              disabled={!mix.length}
              onClick={() => usePlayer.getState().shuffleList(mix, 'forYou')}
            >
              <Icon name="shuffle" size={18} /> Перемешать
            </button>
            <button
              type="button"
              className={`icon-btn${loading ? ' icon-btn--spin' : ''}`}
              onClick={refresh}
              disabled={loading}
              title="Обновить подборку"
            >
              <Icon name="refresh" size={20} />
            </button>
          </div>
        </div>

        {loading && !mix.length ? (
          <div className="loading-more">Подбираем музыку…</div>
        ) : (
          <>
            <TrackTable
              tracks={expanded ? mix : mix.slice(0, PREVIEW)}
              queue={mix}
              source="forYou"
              showHeader={false}
            />
            {mix.length > PREVIEW && (
              <button type="button" className="text-btn for-you__more" onClick={() => setExpanded((v) => !v)}>
                {expanded ? 'Свернуть' : `Показать все ${mix.length}`}
              </button>
            )}
          </>
        )}
      </section>

      {artists.length > 0 && (
        <Shelf title="Исполнители для вас">
          {artists.map((artist) => (
            <ArtistCard key={artist.id} artist={artist} />
          ))}
        </Shelf>
      )}

      {shelves.map((shelf) => (
        <Shelf key={shelf.id} title={shelf.title} subtitle={shelf.subtitle}>
          {shelf.tracks.map((track, i) => (
            <TrackCard key={track.videoId} track={track} queue={shelf.tracks} index={i} source="forYou" />
          ))}
        </Shelf>
      ))}
    </>
  );
}
