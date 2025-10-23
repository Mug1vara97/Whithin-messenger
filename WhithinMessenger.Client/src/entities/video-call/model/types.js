// Типы для видеозвонков
export const VIDEO_CALL_STATUS = {
  IDLE: 'idle',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  DISCONNECTED: 'disconnected',
  ERROR: 'error'
};

export const VIDEO_CALL_MODE = {
  GRID: 'grid',
  FOCUSED: 'focused'
};

export const PARTICIPANT_STATUS = {
  ONLINE: 'online',
  OFFLINE: 'offline',
  AWAY: 'away',
  BUSY: 'busy'
};

export const PARTICIPANT_ROLE = {
  HOST: 'host',
  MODERATOR: 'moderator',
  PARTICIPANT: 'participant'
};

// Тип участника видеозвонка
export const createParticipant = (id, name, avatar, status = PARTICIPANT_STATUS.ONLINE, role = PARTICIPANT_ROLE.PARTICIPANT) => ({
  id,
  name,
  avatar,
  status,
  role,
  isMuted: false,
  isVideoEnabled: true,
  isSpeaking: false,
  lastSeen: new Date(),
  isTyping: false
});

// Тип видеозвонка
export const createVideoCall = (id, name, participants = [], mode = VIDEO_CALL_MODE.GRID) => ({
  id,
  name,
  participants,
  mode,
  status: VIDEO_CALL_STATUS.IDLE,
  createdAt: new Date(),
  maxParticipants: 50
});



