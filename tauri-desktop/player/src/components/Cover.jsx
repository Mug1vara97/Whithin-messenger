import { useState } from 'react';
import { Icon } from './Icon';
import { imageSrc, retryDirect } from '../lib/image';

export function Cover({ track, size, className = '' }) {
  const [broken, setBroken] = useState(false);
  const style = size ? { width: size, height: size } : undefined;
  return (
    <div className={`cover ${className}`} style={style}>
      {track?.thumbnailUrl && !broken ? (
        <img
          key={track.thumbnailUrl}
          src={imageSrc(track.thumbnailUrl, size || 160)}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={(e) => retryDirect(e, track.thumbnailUrl) || setBroken(true)}
        />
      ) : (
        <Icon name="note" size={Math.max(16, Math.round((size || 40) * 0.4))} />
      )}
    </div>
  );
}
