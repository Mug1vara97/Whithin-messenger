import React from 'react';

import { getUserStatusColor, getUserStatusLabel } from '../../../lib/utils/userStatus';

const UserAvatarPresenceDot = ({ status, title, className = '' }) => (
  <span
    className={`user-avatar-presence-dot${className ? ` ${className}` : ''}`}
    style={{ backgroundColor: getUserStatusColor(status) }}
    title={title ?? getUserStatusLabel(status)}
  />
);

export default UserAvatarPresenceDot;
