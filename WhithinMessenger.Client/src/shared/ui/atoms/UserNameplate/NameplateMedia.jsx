import React, { useEffect, useRef, useState } from 'react';
import { isNameplateVideo } from '../../../lib/utils/nameplateHelpers';

const NameplateMedia = ({
  nameplate,
  mediaUrl,
  className = 'user-nameplate__media',
}) => {
  const videoRef = useRef(null);
  const objectUrlRef = useRef(null);
  const [renderAsVideo, setRenderAsVideo] = useState(() => isNameplateVideo(nameplate));
  const [src, setSrc] = useState(mediaUrl);

  useEffect(() => {
    setRenderAsVideo(isNameplateVideo(nameplate));
    setSrc(mediaUrl);

    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }, [nameplate, mediaUrl]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !renderAsVideo) return undefined;

    const play = () => {
      const promise = video.play();
      if (promise?.catch) {
        promise.catch(() => {});
      }
    };

    play();
    return undefined;
  }, [src, renderAsVideo]);

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

  const handleImageError = () => {
    setRenderAsVideo(true);
  };

  const handleVideoError = () => {
    void promoteToVideoBlob();
  };

  if (renderAsVideo) {
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
        onError={handleVideoError}
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
      onError={handleImageError}
    />
  );
};

export default NameplateMedia;
