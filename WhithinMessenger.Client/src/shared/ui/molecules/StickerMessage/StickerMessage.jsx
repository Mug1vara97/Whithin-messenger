import React from 'react';
import { buildMediaUrl } from '../../../lib/utils/urlHelpers';
import './StickerMessage.css';

const isVideoSticker = (sticker) => {
  const contentType = sticker?.contentType ?? '';
  const filePath = sticker?.filePath ?? '';
  return contentType.startsWith('video/') || filePath.toLowerCase().endsWith('.webm');
};

const StickerMessage = ({ sticker, size = 180, className = '' }) => {
  if (!sticker?.filePath) {
    return null;
  }

  const src = buildMediaUrl(sticker.filePath);
  if (!src) {
    return null;
  }

  const mediaClass = `sticker-message__media sticker-message__media--${size}`;

  if (isVideoSticker(sticker)) {
    return (
      <div className={`sticker-message ${className}`.trim()}>
        <video
          src={src}
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          className={mediaClass}
          aria-label="Стикер"
        />
      </div>
    );
  }

  return (
    <div className={`sticker-message ${className}`.trim()}>
      <img
        src={src}
        alt="Стикер"
        className={mediaClass}
        loading="lazy"
        draggable={false}
      />
    </div>
  );
};

export default StickerMessage;
