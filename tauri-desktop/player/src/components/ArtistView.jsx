import { useEffect, useState } from 'react';
import { AlbumCard, ArtistCard, CARD_ART_PX, Shelf } from './Cards';
import { Icon } from './Icon';
import { preloadImages, proxiedImage } from '../lib/image';
import { PlayButton } from './PlayButton';
import { TrackTable } from './TrackTable';
import { formatSubscribers } from '../lib/format';
import { useCatalog } from '../lib/useCatalog';
import { usePlayer } from '../store/player';

export function ArtistView({ id }) {
  const { data: artist, error, retry } = useCatalog('music_artist', { artistId: id });
  const source = usePlayer((s) => s.source);
  const playing = usePlayer((s) => s.playing);
  const radioLoading = usePlayer((s) => s.radioLoading);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!artist) return;
    preloadImages(artist.tracks.map((t) => t.thumbnailUrl), 40);
    preloadImages(artist.albums.map((a) => a.coverUrl), CARD_ART_PX);
  }, [artist]);

  if (error && !artist) {
    return (
      <div className="view">
        <div className="empty empty--error">
          <h2>{error}</h2>
          <button type="button" className="pill-btn" onClick={retry}>
            Повторить
          </button>
        </div>
      </div>
    );
  }
  if (!artist) return <div className="loading-more">Загрузка…</div>;

  const sourceId = `artist:${artist.id}`;
  const radioId = `artist-radio:${artist.id}`;
  const isActive = source === sourceId;
  const onPlay = () => {
    if (isActive) usePlayer.getState().togglePlay();
    else if (artist.tracks.length) usePlayer.getState().playList(artist.tracks, 0, { source: sourceId });
  };
  const onRadio = () => {
    const seed = artist.radioId || artist.tracks[0]?.videoId;
    if (seed) usePlayer.getState().playRadio(seed, { source: radioId });
  };
  const subscribers = formatSubscribers(artist.subscribers);

  return (
    <div className="view">
      <header className="artist-hero" style={artist.imageUrl ? { '--hero-image': `url("${proxiedImage(artist.imageUrl)}")` } : undefined}>
        <div className="artist-hero__shade" />
        <div className="artist-hero__info">
          <span className="hero__kind">Исполнитель</span>
          <h1 className="hero__title">{artist.name}</h1>
          {subscribers && <span className="hero__meta">{subscribers}</span>}
        </div>
      </header>

      <div className="view__body">
        <div className="action-bar">
          <PlayButton playing={isActive && playing} onClick={onPlay} />
          <button
            type="button"
            className={`outline-btn${source === radioId ? ' outline-btn--on' : ''}`}
            onClick={onRadio}
            disabled={radioLoading}
          >
            <Icon name="radio" size={18} />
            Радио исполнителя
          </button>
        </div>

        {artist.tracks.length > 0 && (
          <section>
            <h2 className="section-title">Популярные треки</h2>
            <TrackTable
              tracks={expanded ? artist.tracks : artist.tracks.slice(0, 5)}
              queue={artist.tracks}
              source={sourceId}
              showHeader={false}
            />
            {artist.tracks.length > 5 && (
              <button type="button" className="text-btn text-btn--pad" onClick={() => setExpanded((v) => !v)}>
                {expanded ? 'Свернуть' : 'Ещё'}
              </button>
            )}
          </section>
        )}

        {artist.albums.length > 0 && (
          <Shelf title="Альбомы и синглы">
            {artist.albums.map((album) => (
              <AlbumCard key={album.id} album={{ ...album, artist: '' }} />
            ))}
          </Shelf>
        )}

        {artist.similar.length > 0 && (
          <Shelf title="Похожие исполнители">
            {artist.similar.map((similar) => (
              <ArtistCard key={similar.id} artist={similar} />
            ))}
          </Shelf>
        )}

        {artist.description && (
          <section className="about">
            <h2 className="section-title">Об исполнителе</h2>
            <p>{artist.description}</p>
          </section>
        )}
      </div>
    </div>
  );
}
