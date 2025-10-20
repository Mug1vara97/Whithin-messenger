// Типы для голосовых звонков
export const CALL_TYPES = {
  PRIVATE: 'private',
  GROUP: 'group',
  SERVER: 'server'
};

export const CALL_STATUS = {
  IDLE: 'idle',
  RINGING: 'ringing',
  ACTIVE: 'active',
  ENDED: 'ended',
  ERROR: 'error'
};

export const MEDIA_TYPES = {
  AUDIO: 'audio',
  VIDEO: 'video',
  SCREEN: 'screen'
};

export const VOICE_STATES = {
  MUTED: 'muted',
  UNMUTED: 'unmuted',
  DEAFENED: 'deafened',
  SPEAKING: 'speaking'
};
