import React from 'react';
import VideoPlayer from '../../../shared/ui/molecules/MediaFile/VideoPlayer';
import { buildMediaUrl } from '../../../shared/lib/utils/urlHelpers';

export const FeedImage = ({ src, alt = '', className = '' }) => (
  <div className={`feed-media ${className}`}>
    <img className="feed-media__img" src={src} alt={alt} loading="lazy" draggable={false} />
  </div>
);

export const FeedVideo = ({ item }) => (
  <VideoPlayer
    className="feed-media-video"
    src={buildMediaUrl(item.filePath)}
    poster={item.thumbnailPath ? buildMediaUrl(item.thumbnailPath) : undefined}
  />
);
