import { useState } from 'react';
import { AlbumCard, ArtistCard, Shelf, TrackCard } from './Cards';
import { ForYou } from './ForYou';
import { Icon } from './Icon';
import { PlayButton } from './PlayButton';
import { SearchField } from './SearchField';
import { SearchView } from './SearchView';
import { TrackTable } from './TrackTable';
import { useCatalog } from '../lib/useCatalog';
import { useLibrary } from '../store/library';
import { usePlayer } from '../store/player';
import { useSearch } from '../store/search';

/** «Главная»: the feed, replaced by search results while the search field has text. */
export function HomeView({ scrollRef }) {
  const searching = useSearch((s) => s.query.trim().length > 0);
  return searching ? <SearchView scrollRef={scrollRef} /> : <HomeFeed />;
}

function HomeFeed() {
  const { data: home, error, retry } = useCatalog('music_home', {});
  const library = useLibrary((s) => s.tracks);
  const source = usePlayer((s) => s.source);
  const playing = usePlayer((s) => s.playing);
  const radioLoading = usePlayer((s) => s.radioLoading);
  const [chartExpanded, setChartExpanded] = useState(false);

  const waveActive = source === 'wave';
  const startWave = () => {
    if (waveActive) {
      usePlayer.getState().togglePlay();
      return;
    }
    const pool = library.length ? library : home?.topTracks || [];
    if (!pool.length) return;
    const seed = pool[Math.floor(Math.random() * pool.length)];
    usePlayer.getState().playRadio(seed.videoId, { source: 'wave' });
  };

  const chart = home?.topTracks || [];

  return (
    <div className="view">
      <div className="search-bar">
        <SearchField />
      </div>
      <div className="view__body view__body--home">

        <div className="wave" role="button" tabIndex={0} onClick={startWave}>
          <div className="wave__glow" />
          <div className="wave__info">
            <span className="wave__kind">
              <Icon name="radio" size={18} /> Радио
            </span>
            <h2 className="wave__title">Моя волна</h2>
            <p className="wave__sub">
              {library.length
                ? 'Бесконечный поток музыки, похожей на вашу «Мою музыку»'
                : 'Бесконечный поток популярной музыки — добавляйте треки, и волна подстроится под вас'}
            </p>
          </div>
          <div className={`wave__play${radioLoading && !waveActive ? ' wave__play--busy' : ''}`}>
            <PlayButton
              size={64}
              playing={waveActive && playing}
              onClick={(e) => {
                e.stopPropagation();
                startWave();
              }}
            />
          </div>
        </div>

        <ForYou />

        {library.length > 0 && (
          <Shelf title="Из «Моей музыки»">
            {library.slice(0, 12).map((track, i) => (
              <TrackCard key={track.videoId} track={track} queue={library} index={i} source="library" />
            ))}
          </Shelf>
        )}

        {!home && !error && <div className="loading-more">Загрузка рекомендаций…</div>}
        {error && !home && (
          <div className="empty empty--error">
            <h2>{error}</h2>
            <button type="button" className="pill-btn" onClick={retry}>
              Повторить
            </button>
          </div>
        )}

        {chart.length > 0 && (
          <section>
            <div className="shelf__head">
              <h2 className="section-title">Топ-чарт</h2>
              {chart.length > 10 && (
                <button type="button" className="text-btn" onClick={() => setChartExpanded((v) => !v)}>
                  {chartExpanded ? 'Свернуть' : 'Показать все'}
                </button>
              )}
            </div>
            <TrackTable tracks={chartExpanded ? chart : chart.slice(0, 10)} queue={chart} source="chart" showHeader={false} />
          </section>
        )}

        {home?.trending?.length > 0 && (
          <Shelf title="В тренде">
            {home.trending.map((track, i) => (
              <TrackCard key={track.videoId} track={track} queue={home.trending} index={i} source="trending" />
            ))}
          </Shelf>
        )}

        {home?.artists?.length > 0 && (
          <Shelf title="Популярные исполнители">
            {home.artists.map((artist) => (
              <ArtistCard key={artist.id} artist={artist} />
            ))}
          </Shelf>
        )}

        {home?.newAlbums?.length > 0 && (
          <Shelf title="Новые релизы">
            {home.newAlbums.map((album) => (
              <AlbumCard key={album.id} album={album} />
            ))}
          </Shelf>
        )}
      </div>
    </div>
  );
}
