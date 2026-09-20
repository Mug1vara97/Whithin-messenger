import React from 'react';

import { useResolvedPresence } from '../../../lib/contexts/PresenceContext';
import { getPresenceSnapshot, normalizeUserStatus } from '../../../lib/utils/userStatus';

/**
 * Discord-like presence pill.
 * Always derives color + shape from one normalized status.
 */
const UserAvatarPresenceDot = ({ userId = null, status, title, className = '' }) => {
  const presence = useResolvedPresence(userId, status);
  const snapshot =
    userId != null
      ? presence
      : getPresenceSnapshot(normalizeUserStatus(status));

  return (
    <span
      className={[
        'user-avatar-presence-dot',
        `user-avatar-presence-dot--${snapshot.normalized}`,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      style={{ ['--presence-color']: snapshot.color }}
      title={title ?? snapshot.label}
      aria-label={title ?? snapshot.label}
    />
  );
};

export default UserAvatarPresenceDot;
