import React, { useEffect, useRef } from 'react';
import {
  isNameplateVideo,
  resolveNameplateUrl,
} from '../../../lib/utils/nameplateHelpers';
import './UserNameplate.css';

const UserNameplate = ({
  nameplate,
  className = '',
  contentClassName = '',
  children,
}) => {
  const videoRef = useRef(null);
  const mediaUrl = resolveNameplateUrl(nameplate);
  const hasNameplate = Boolean(mediaUrl);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !isNameplateVideo(nameplate)) return undefined;

    const play = () => {
      const promise = video.play();
      if (promise?.catch) {
        promise.catch(() => {});
      }
    };

    play();
    return undefined;
  }, [mediaUrl, nameplate]);

  if (!hasNameplate) {
    return (
      <div className={`user-nameplate user-nameplate--empty ${className}`.trim()}>
        <div className={`user-nameplate__content ${contentClassName}`.trim()}>
          {children}
        </div>
      </div>
    );
  }

  return (
    <div className={`user-nameplate ${className}`.trim()}>
      {isNameplateVideo(nameplate) ? (
        <video
          ref={videoRef}
          className="user-nameplate__media"
          src={mediaUrl}
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          aria-hidden="true"
        />
      ) : (
        <div
          className="user-nameplate__media user-nameplate__media--image"
          style={{ backgroundImage: `url(${mediaUrl})` }}
          aria-hidden="true"
        />
      )}
      <div className="user-nameplate__shade" aria-hidden="true" />
      <div className={`user-nameplate__content ${contentClassName}`.trim()}>
        {children}
      </div>
    </div>
  );
};

export default UserNameplate;
