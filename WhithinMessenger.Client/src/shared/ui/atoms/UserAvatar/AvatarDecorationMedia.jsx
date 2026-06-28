import React, { useEffect, useRef, useState } from 'react';
import { isAvatarDecorationVideoUrl } from '../../../lib/utils/avatarDecorationHelpers';
import { enqueueDecorationImageLoad } from '../../../lib/utils/decorationImageQueue';

const AvatarDecorationMedia = ({ src, className = 'user-avatar-decoration' }) => {
  const videoRef = useRef(null);
  const isVideo = isAvatarDecorationVideoUrl(src);
  const [resolvedSrc, setResolvedSrc] = useState(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (!src || isVideo) {
      setResolvedSrc(isVideo ? src : null);
      setRetryCount(0);
      return undefined;
    }

    let cancelled = false;
    setResolvedSrc(null);
    setRetryCount(0);

    enqueueDecorationImageLoad(async () => {
      if (!cancelled) {
        setResolvedSrc(src);
      }
    }).catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [src, isVideo]);

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
        preload="metadata"
        aria-hidden="true"
      />
    );
  }

  if (!resolvedSrc) {
    return null;
  }

  const imageSrc = retryCount > 0
    ? `${resolvedSrc}${resolvedSrc.includes('?') ? '&' : '?'}retry=${retryCount}`
    : resolvedSrc;

  return (
    <img
      className={className}
      src={imageSrc}
      alt=""
      aria-hidden="true"
      draggable={false}
      loading="lazy"
      decoding="async"
      fetchPriority="low"
      onError={() => {
        if (retryCount < 2) {
          setRetryCount((count) => count + 1);
        }
      }}
    />
  );
};

export default AvatarDecorationMedia;
