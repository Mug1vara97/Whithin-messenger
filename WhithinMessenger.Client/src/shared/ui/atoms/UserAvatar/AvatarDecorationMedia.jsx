import React, { useEffect, useRef } from 'react';
import { isAvatarDecorationVideoUrl } from '../../../lib/utils/avatarDecorationHelpers';

const AvatarDecorationMedia = ({ src, className = 'user-avatar-decoration' }) => {
  const videoRef = useRef(null);
  const isVideo = isAvatarDecorationVideoUrl(src);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !isVideo) return undefined;

    const play = () => {
      const promise = video.play();
      if (promise?.catch) {
        promise.catch(() => {});
      }
    };

    play();
    return undefined;
  }, [src, isVideo]);

  if (isVideo) {
    return (
      <video
        ref={videoRef}
        className={className}
        src={src}
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        aria-hidden="true"
      />
    );
  }

  return (
    <img
      className={className}
      src={src}
      alt=""
      aria-hidden="true"
      draggable={false}
    />
  );
};

export default AvatarDecorationMedia;
