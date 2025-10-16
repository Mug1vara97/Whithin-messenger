export const MEMBER_STATUS = {
  ONLINE: 'online',
  OFFLINE: 'offline',
  AWAY: 'away',
  BUSY: 'busy'
};

export const MEMBER_STATUS_LABELS = {
  [MEMBER_STATUS.ONLINE]: 'В сети',
  [MEMBER_STATUS.OFFLINE]: 'Не в сети',
  [MEMBER_STATUS.AWAY]: 'Отошёл',
  [MEMBER_STATUS.BUSY]: 'Занят'
};

export const MEMBER_STATUS_COLORS = {
  [MEMBER_STATUS.ONLINE]: '#43b581',
  [MEMBER_STATUS.OFFLINE]: '#747f8d',
  [MEMBER_STATUS.AWAY]: '#faa61a',
  [MEMBER_STATUS.BUSY]: '#f04747'
};
