import React from 'react';
import { isNameplateVideo } from '../../../lib/utils/nameplateHelpers';
import LegacyNameplateVideo from './LegacyNameplateVideo';

const NameplateMedia = ({
  nameplate,
  mediaUrl,
  className = 'user-nameplate__media',
}) => {
  if (isNameplateVideo(nameplate)) {
    return (
      <LegacyNameplateVideo
        mediaUrl={mediaUrl}
        className={className}
      />
    );
  }

  return (
    <img
      className={className}
      src={mediaUrl}
      alt=""
      aria-hidden="true"
      draggable={false}
    />
  );
};

export default NameplateMedia;
