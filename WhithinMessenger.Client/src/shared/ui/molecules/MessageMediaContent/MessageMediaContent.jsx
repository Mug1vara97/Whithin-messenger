import React from 'react';
import MediaFile from '../MediaFile/MediaFile';
import MessageMediaAlbum from '../MessageMediaAlbum/MessageMediaAlbum';
import { categorizeMessageMedia } from '../../../lib/utils/messageMediaHelpers';
import '../MessageMediaAlbum/MessageMediaAlbum.css';

const MessageMediaContent = ({
  mediaFiles = [],
  timestamp = '',
  showAlbumTimeBadge = true,
  onVideoClick,
  renderCaption = null,
}) => {
  const { visualMedia, voiceMedia, fileMedia } = categorizeMessageMedia(mediaFiles);
  const hasVisualAlbum = visualMedia.length >= 2;
  const hasCaption = Boolean(renderCaption);
  const showAlbumBadge = showAlbumTimeBadge && !hasCaption;

  if (!mediaFiles.length) return null;

  return (
    <div className="message-media-block">
      {visualMedia.length > 0 && (
        <div className={`message-media ${hasVisualAlbum ? 'message-media--album' : ''}`}>
          {hasVisualAlbum ? (
            <MessageMediaAlbum
              mediaFiles={visualMedia}
              timestamp={timestamp}
              showTimeBadge={showAlbumBadge}
              onVideoClick={onVideoClick}
            />
          ) : (
            visualMedia.map((mediaFile) => (
              <MediaFile
                key={mediaFile.id || mediaFile.filePath}
                mediaFile={mediaFile}
                canDelete={false}
              />
            ))
          )}
        </div>
      )}

      {hasCaption && (
        <div className="message-media-block__caption message-text">
          {renderCaption()}
        </div>
      )}

      {voiceMedia.length > 0 && (
        <div className="message-media">
          {voiceMedia.map((mediaFile) => (
            <MediaFile
              key={mediaFile.id || mediaFile.filePath}
              mediaFile={mediaFile}
              canDelete={false}
            />
          ))}
        </div>
      )}

      {fileMedia.length > 0 && (
        <div className="message-file-group">
          {fileMedia.map((mediaFile) => (
            <MediaFile
              key={mediaFile.id || mediaFile.filePath}
              mediaFile={mediaFile}
              canDelete={false}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default MessageMediaContent;
