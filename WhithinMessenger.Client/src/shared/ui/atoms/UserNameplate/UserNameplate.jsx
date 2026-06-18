import React from 'react';
import { resolveNameplateUrl } from '../../../lib/utils/nameplateHelpers';
import NameplateMedia from './NameplateMedia';
import './UserNameplate.css';

const UserNameplate = ({
  nameplate,
  className = '',
  contentClassName = '',
  children,
}) => {
  const mediaUrl = resolveNameplateUrl(nameplate);
  const hasNameplate = Boolean(mediaUrl);

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
    <div className={`user-nameplate user-nameplate--decorated ${className}`.trim()}>
      <NameplateMedia nameplate={nameplate} mediaUrl={mediaUrl} />
      <div className="user-nameplate__shade" aria-hidden="true" />
      <div className={`user-nameplate__content ${contentClassName}`.trim()}>
        {children}
      </div>
    </div>
  );
};

export default UserNameplate;
