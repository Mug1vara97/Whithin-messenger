export const PRESENCE_STATUS = {
  ONLINE: 'online',
  INACTIVE: 'inactive',
  DO_NOT_DISTURB: 'do_not_disturb',
  OFFLINE: 'offline'
};

const STATUS_LABELS = {
  [PRESENCE_STATUS.ONLINE]: 'Онлайн',
  [PRESENCE_STATUS.INACTIVE]: 'Не активен',
  [PRESENCE_STATUS.DO_NOT_DISTURB]: 'Не беспокоить',
  [PRESENCE_STATUS.OFFLINE]: 'Не в сети'
};

const STATUS_COLORS = {
  [PRESENCE_STATUS.ONLINE]: '#43b581',
  [PRESENCE_STATUS.INACTIVE]: '#f0b232',
  [PRESENCE_STATUS.DO_NOT_DISTURB]: '#f23f43',
  [PRESENCE_STATUS.OFFLINE]: '#80848e'
};

const USER_STATUS_OPTIONS = [
  PRESENCE_STATUS.ONLINE,
  PRESENCE_STATUS.INACTIVE,
  PRESENCE_STATUS.DO_NOT_DISTURB,
  PRESENCE_STATUS.OFFLINE
];

export const normalizeUserStatus = (status) => {
  if (status === null || status === undefined) {
    return PRESENCE_STATUS.OFFLINE;
  }

  if (typeof status === 'number') {
    switch (status) {
      case 0:
        return PRESENCE_STATUS.ONLINE;
      case 1:
        return PRESENCE_STATUS.INACTIVE;
      case 2:
        return PRESENCE_STATUS.DO_NOT_DISTURB;
      case 3:
      default:
        return PRESENCE_STATUS.OFFLINE;
    }
  }

  if (typeof status !== 'string') {
    return PRESENCE_STATUS.OFFLINE;
  }

  const normalized = status.trim().toLowerCase().replace(/[\s_-]/g, '');

  if (normalized === 'online') {
    return PRESENCE_STATUS.ONLINE;
  }

  if (normalized === 'inactive' || normalized === 'away' || normalized === 'idle') {
    return PRESENCE_STATUS.INACTIVE;
  }

  if (normalized === 'donotdisturb' || normalized === 'dnd' || normalized === 'busy') {
    return PRESENCE_STATUS.DO_NOT_DISTURB;
  }

  if (normalized === 'offline') {
    return PRESENCE_STATUS.OFFLINE;
  }

  return PRESENCE_STATUS.OFFLINE;
};

export const isUserActiveInFriendsList = (status) => {
  const normalized = normalizeUserStatus(status);
  return normalized === PRESENCE_STATUS.ONLINE || normalized === PRESENCE_STATUS.INACTIVE;
};

export const getUserStatusLabel = (status) => STATUS_LABELS[normalizeUserStatus(status)];

export const getUserStatusColor = (status) => STATUS_COLORS[normalizeUserStatus(status)];

export const getPresenceSnapshot = (status) => {
  const normalized = normalizeUserStatus(status);
  return {
    normalized,
    label: STATUS_LABELS[normalized],
    color: STATUS_COLORS[normalized],
  };
};

export const getUserStatusOptions = () => USER_STATUS_OPTIONS.map((value) => ({
  value,
  label: STATUS_LABELS[value],
  color: STATUS_COLORS[value]
}));

export const toBackendUserStatus = (status) => {
  switch (normalizeUserStatus(status)) {
    case PRESENCE_STATUS.ONLINE:
      return 'Online';
    case PRESENCE_STATUS.INACTIVE:
      return 'Inactive';
    case PRESENCE_STATUS.DO_NOT_DISTURB:
      return 'DoNotDisturb';
    case PRESENCE_STATUS.OFFLINE:
    default:
      return 'Offline';
  }
};
