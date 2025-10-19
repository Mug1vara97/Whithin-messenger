// Типы для голосовых звонков
export const CALL_TYPES = {
  PRIVATE: 'private',
  GROUP: 'group',
  SERVER: 'server'
};

export const CALL_STATUS = {
  IDLE: 'idle',
  RINGING: 'ringing',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  DISCONNECTED: 'disconnected',
  FAILED: 'failed'
};

export const MEDIA_TYPES = {
  AUDIO: 'audio',
  VIDEO: 'video',
  SCREEN: 'screen'
};

export const AUDIO_SETTINGS = {
  ECHO_CANCELLATION: 'echoCancellation',
  NOISE_SUPPRESSION: 'noiseSuppression',
  AUTO_GAIN_CONTROL: 'autoGainControl',
  HIGH_PASS_FILTER: 'highpassFilter'
};

export const NOISE_SUPPRESSION_MODES = {
  OFF: 'off',
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high'
};

export const CALL_EVENTS = {
  CALL_INITIATED: 'callInitiated',
  CALL_ACCEPTED: 'callAccepted',
  CALL_REJECTED: 'callRejected',
  CALL_ENDED: 'callEnded',
  USER_JOINED: 'userJoined',
  USER_LEFT: 'userLeft',
  MEDIA_STATE_CHANGED: 'mediaStateChanged',
  SPEAKING_STATE_CHANGED: 'speakingStateChanged'
};
