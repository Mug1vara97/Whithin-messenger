// Типы для чата
export const CHAT_TYPES = {
  PRIVATE: 1,
  GROUP: 2,
  SERVER: 3
};

export const CHAT_STATUS = {
  ACTIVE: 'active',
  ARCHIVED: 'archived',
  DELETED: 'deleted'
};

export const MESSAGE_TYPES = {
  TEXT: 'text',
  IMAGE: 'image',
  VIDEO: 'video',
  AUDIO: 'audio',
  FILE: 'file',
  VOICE: 'voice'
};

export const USER_PERMISSIONS = {
  SEND_MESSAGES: 'sendMessages',
  MANAGE_MESSAGES: 'manageMessages',
  DELETE_MESSAGES: 'deleteMessages',
  ATTACH_FILES: 'attachFiles',
  SEND_VOICE_MESSAGES: 'sendVoiceMessages',
  MANAGE_CHAT: 'manageChat'
};