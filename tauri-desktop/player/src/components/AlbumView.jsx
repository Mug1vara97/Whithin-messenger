import { Icon } from './Icon';
import { imageSrc, retryDirect } from '../lib/image';
import { PlayButton } from './PlayButton';
import { TrackTable } from './TrackTable';
import { ALBUM_KIND, formatTotal, pluralTracks } from '../lib/format';
import { useCatalog } from '../lib/useCatalog';
import { openArtist } from '../store/nav';
import { usePlayer } from '../store/player';

export function AlbumView({ id }) {
  const { data: album, error, retry } = useCatalog('music_album', { albumId: id });
  const source = usePlayer((s) => s.source);
  const playing = usePlayer((s) => s.playing);
  const shuffle = usePlayer((s) => s.shuffle);

  if (error && !album) {
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
  if (!album) return <div className="loading-more">Загрузка…</div>;

  const sourceId = `album:${album.id}`;
  const isActive = source === sourceId;
  const onPlay = () => {
    if (isActive) usePlayer.getState().togglePlay();
    else if (album.tracks.length) usePlayer.getState().playList(album.tracks, 0, { source: sourceId, shuffle });
  };

  return (
    <div className="view">
      <header className="hero">
        <div className="hero__art hero__art--image">
          {album.coverUrl ? (
            <img
              key={album.coverUrl}
              src={imageSrc(album.coverUrl, 232)}
              alt=""
              referrerPolicy="no-referrer"
              onError={(e) => retryDirect(e, album.coverUrl)}
            />
          ) : (
            <Icon name="note" size={84} />
          )}
        </div>
        <div className="hero__info">
          <span className="hero__kind">{ALBUM_KIND[album.kind] || 'Альбом'}</span>
          <h1 className="hero__title hero__title--md">{album.name}</h1>
          <span className="hero__meta">
            {album.artistId ? (
              <strong className="link" role="link" tabIndex={0} onClick={() => openArtist(album.artistId)}>
                {album.artist}
              </strong>
            ) : (
              <strong>{album.artist}</strong>
            )}
            {album.year && ` · ${album.year}`}
            {` · ${pluralTracks(album.tracks.length)}`}
            {album.tracks.length > 0 && `, ${formatTotal(album.tracks)}`}
          </span>
        </div>
      </header>

      <div className="view__body">
        <div className="action-bar">
          <PlayButton playing={isActive && playing} onClick={onPlay} />
        </div>
        <TrackTable tracks={album.tracks} source={sourceId} />
      </div>
    </div>
  );
}
