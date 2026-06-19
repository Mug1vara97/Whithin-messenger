import React, { useEffect, useRef, useState } from 'react';

/** Playback for legacy WebM nameplates saved before WebP-only policy. */
const LegacyNameplateVideo = ({ mediaUrl, className = 'user-nameplate__media' }) => {
  const videoRef = useRef(null);
  const objectUrlRef = useRef(null);
  const [src, setSrc] = useState(mediaUrl);

  useEffect(() => {
    setSrc(mediaUrl);

    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }, [mediaUrl]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return undefined;

    const play = () => {
      const promise = video.play();
      if (promise?.catch) {
        promise.catch(() => {});
      }
    };

    play();
    return undefined;
  }, [src]);

  useEffect(
    () => () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
    },
    [],
  );

  const promoteToVideoBlob = async () => {
    if (objectUrlRef.current) return;

    try {
      const response = await fetch(mediaUrl, { credentials: 'include' });
      if (!response.ok) return;

      const buffer = await response.arrayBuffer();
      const objectUrl = URL.createObjectURL(new Blob([buffer], { type: 'video/webm' }));
      objectUrlRef.current = objectUrl;
      setSrc(objectUrl);
    } catch {
      // Keep the original src for another video attempt.
    }
  };

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
      onError={() => {
        void promoteToVideoBlob();
      }}
    />
  );
};

export default LegacyNameplateVideo;
