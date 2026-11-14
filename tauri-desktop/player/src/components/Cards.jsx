import { useState } from 'react';
import { Icon } from './Icon';
import { PlayButton } from './PlayButton';
import { ALBUM_KIND } from '../lib/format';
import { imageSrc, retryDirect } from '../lib/image';
import { openAlbum, openArtist } from '../store/nav';
import { usePlayer } from '../store/player';

export const CARD_ART_PX = 220;

function Art({ url, round, icon = 'note' }) {
  const [broken, setBroken] = useState(false);
  return (
    <div className={`card__art${round ? ' card__art--round' : ''}`}>
      {url && !broken ? (
        <img
          key={url}
          src={imageSrc(url, CARD_ART_PX)}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={(e) => retryDirect(e, url) || setBroken(true)}
        />
      ) : (
        <Icon name={icon} size={48} />
      )}
    </div>
  );
}

export function Shelf({ title, subtitle, children, action }) {
  return (
    <section className="shelf">
      <div className="shelf__head">
        <div>
          {subtitle && <div className="shelf__sub">{subtitle}</div>}
          <h2 className="section-title">{title}</h2>
        </div>
        {action}
      </div>
      <div className="shelf__row">{children}</div>
    </section>
  );
}

export function ArtistCard({ artist }) {
  return (
    <div className="card" role="button" tabIndex={0} onClick={() => openArtist(artist.id)}>
      <Art url={artist.imageUrl} round icon="person" />
      <div className="card__title" title={artist.name}>
        {artist.name}
      </div>
      <div className="card__sub">Исполнитель</div>
    </div>
  );
}

export function AlbumCard({ album }) {
  const kind = ALBUM_KIND[album.kind] || 'Альбом';
  return (
    <div className="card" role="button" tabIndex={0} onClick={() => openAlbum(album.id)}>
      <Art url={album.coverUrl} />
      <div className="card__title" title={album.name}>
        {album.name}
      </div>
      <div className="card__sub">{[album.year, album.artist || kind].filter(Boolean).join(' · ')}</div>
    </div>
  );
}

/** Track tile that plays `queue` starting at `index`. */
export function TrackCard({ track, queue, index, source }) {
  const currentId = usePlayer((s) => s.queue[s.index]?.videoId);
  const playing = usePlayer((s) => s.playing);
  const isCurrent = track.videoId === currentId;
  const play = (e) => {
    e.stopPropagation();
    if (isCurrent) usePlayer.getState().togglePlay();
    else usePlayer.getState().playList(queue, index, { source });
  };
  return (
    <div className={`card${isCurrent ? ' card--current' : ''}`} role="button" tabIndex={0} onClick={play}>
      <div className="card__art-wrap">
        <Art url={track.thumbnailUrl} />
        <div className={`card__play${isCurrent && playing ? ' card__play--on' : ''}`}>
          <PlayButton size={48} playing={isCurrent && playing} onClick={play} />
        </div>
      </div>
      <div className="card__title" title={track.title}>
        {track.title}
      </div>
      <div className="card__sub">{track.artist}</div>
    </div>
  );
}

/** Clickable artist name when the catalog knows the artist's channel. */
export function ArtistLink({ track, className = '' }) {
  if (!track.artistId) return <span className={className}>{track.artist}</span>;
  return (
    <span
      className={`${className} link`}
      role="link"
      tabIndex={0}
      onClick={(e) => {
        e.stopPropagation();
        openArtist(track.artistId);
      }}
    >
      {track.artist}
    </span>
  );
}
