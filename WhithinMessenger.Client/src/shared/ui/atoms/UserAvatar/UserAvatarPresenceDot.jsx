import React from 'react';

import { useResolvedPresence } from '../../../lib/contexts/PresenceContext';
import { getUserStatusColor, getUserStatusLabel } from '../../../lib/utils/userStatus';

const UserAvatarPresenceDot = ({ userId = null, status, title, className = '' }) => {
  const presence = useResolvedPresence(userId, status);
  const resolvedStatus = userId != null ? presence.normalized : status;

  return (
    <span
      className={`user-avatar-presence-dot${className ? ` ${className}` : ''}`}
      style={{ backgroundColor: getUserStatusColor(resolvedStatus) }}
      title={title ?? getUserStatusLabel(resolvedStatus)}
    />
  );
};

export default UserAvatarPresenceDot;
