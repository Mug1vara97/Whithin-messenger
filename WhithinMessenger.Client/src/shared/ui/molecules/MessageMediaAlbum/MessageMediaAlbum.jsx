import React, { useState } from 'react';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import { buildMediaUrl } from '../../../lib/utils/urlHelpers';
import { buildMediaThumbnailUrl } from '../../../lib/utils/messageMediaHelpers';
import ImagePreview from '../ImagePreview/ImagePreview';
import './MessageMediaAlbum.css';

const AlbumCell = ({ mediaFile, onVideoClick }) => {
  const isVideo = mediaFile.contentType?.startsWith('video/');
  const imageUrl = buildMediaThumbnailUrl(mediaFile);
  const openUrl = buildMediaUrl(mediaFile.filePath);
  const [previewOpen, setPreviewOpen] = useState(false);

  const handleClick = () => {
    if (isVideo) {
      onVideoClick?.(openUrl, mediaFile);
      return;
    }
    setPreviewOpen(true);
  };

  return (
    <>
      <button type="button" className="message-media-album__cell" onClick={handleClick}>
        <img
          src={imageUrl}
          alt={mediaFile.originalFileName || mediaFile.fileName || 'Media'}
          loading="lazy"
        />
        {isVideo && (
          <span className="message-media-album__play" aria-hidden="true">
            <span className="message-media-album__play-icon">
              <PlayArrowIcon sx={{ fontSize: 22 }} />
            </span>
          </span>
        )}
      </button>
      {!isVideo && (
        <ImagePreview
          mediaFile={mediaFile}
          isOpen={previewOpen}
          onClose={() => setPreviewOpen(false)}
        />
      )}
    </>
  );
};

const MessageMediaAlbum = ({ mediaFiles, timestamp = '', showTimeBadge = true, onVideoClick }) => {
  if (!mediaFiles?.length) return null;

  const timeBadge =
    showTimeBadge && timestamp ? (
      <span className="message-media-album__time">{timestamp}</span>
    ) : null;

  if (mediaFiles.length === 2) {
    return (
      <div className="message-media-album">
        <div className="message-media-album__row message-media-album__row--tall">
          {mediaFiles.map((mediaFile) => (
            <AlbumCell
              key={mediaFile.id || mediaFile.filePath}
              mediaFile={mediaFile}
              onVideoClick={onVideoClick}
            />
          ))}
        </div>
        {timeBadge}
      </div>
    );
  }

  if (mediaFiles.length === 3) {
    return (
      <div className="message-media-album">
        <div className="message-media-album__row message-media-album__row--tall">
          <AlbumCell
            mediaFile={mediaFiles[0]}
            onVideoClick={onVideoClick}
          />
          <div className="message-media-album__column">
            <AlbumCell
              mediaFile={mediaFiles[1]}
              onVideoClick={onVideoClick}
            />
            <AlbumCell
              mediaFile={mediaFiles[2]}
              onVideoClick={onVideoClick}
            />
          </div>
        </div>
        {timeBadge}
      </div>
    );
  }

  const rows = mediaFiles.reduce((acc, mediaFile, index) => {
    if (index % 2 === 0) {
      acc.push([mediaFile]);
    } else {
      acc[acc.length - 1].push(mediaFile);
    }
    return acc;
  }, []);

  return (
    <div className="message-media-album">
      {rows.map((row, rowIndex) => (
        <div
          key={`album-row-${rowIndex}`}
          className="message-media-album__row message-media-album__row--short"
        >
          {row.map((mediaFile) => (
            <AlbumCell
              key={mediaFile.id || mediaFile.filePath}
              mediaFile={mediaFile}
              onVideoClick={onVideoClick}
            />
          ))}
        </div>
      ))}
      {timeBadge}
    </div>
  );
};

export default MessageMediaAlbum;
