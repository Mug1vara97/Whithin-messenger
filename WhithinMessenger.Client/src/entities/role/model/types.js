export const ROLE_PERMISSIONS = {
  // Основные разрешения
  VIEW_CHANNELS: 'viewChannels',
  MANAGE_CHANNELS: 'manageChannels',
  MANAGE_ROLES: 'manageRoles',
  MANAGE_SERVER: 'manageServer',
  CREATE_INVITES: 'createInvites',
  
  // Управление участниками
  CHANGE_OWN_NICKNAME: 'changeOwnNickname',
  MANAGE_NICKNAMES: 'manageNicknames',
  KICK_MEMBERS: 'kickMembers',
  BAN_MEMBERS: 'banMembers',
  
  // Управление сообщениями
  SEND_MESSAGES: 'sendMessages',
  ATTACH_FILES: 'attachFiles',
  MENTION_EVERYONE: 'mentionEveryone',
  MANAGE_MESSAGES: 'manageMessages',
  SEND_VOICE_MESSAGES: 'sendVoiceMessages'
};

export const PERMISSION_CATEGORIES = {
  general: {
    title: 'Основные разрешения',
    permissions: [
      ROLE_PERMISSIONS.VIEW_CHANNELS,
      ROLE_PERMISSIONS.MANAGE_CHANNELS,
      ROLE_PERMISSIONS.MANAGE_ROLES,
      ROLE_PERMISSIONS.MANAGE_SERVER,
      ROLE_PERMISSIONS.CREATE_INVITES
    ]
  },
  members: {
    title: 'Управление участниками',
    permissions: [
      ROLE_PERMISSIONS.CHANGE_OWN_NICKNAME,
      ROLE_PERMISSIONS.MANAGE_NICKNAMES,
      ROLE_PERMISSIONS.KICK_MEMBERS,
      ROLE_PERMISSIONS.BAN_MEMBERS
    ]
  },
  messages: {
    title: 'Управление сообщениями',
    permissions: [
      ROLE_PERMISSIONS.SEND_MESSAGES,
      ROLE_PERMISSIONS.ATTACH_FILES,
      ROLE_PERMISSIONS.MENTION_EVERYONE,
      ROLE_PERMISSIONS.MANAGE_MESSAGES,
      ROLE_PERMISSIONS.SEND_VOICE_MESSAGES
    ]
  }
};

export const PERMISSION_LABELS = {
  [ROLE_PERMISSIONS.VIEW_CHANNELS]: 'Просмотр каналов',
  [ROLE_PERMISSIONS.MANAGE_CHANNELS]: 'Управлять каналами',
  [ROLE_PERMISSIONS.MANAGE_ROLES]: 'Управлять ролями',
  [ROLE_PERMISSIONS.MANAGE_SERVER]: 'Управлять сервером',
  [ROLE_PERMISSIONS.CREATE_INVITES]: 'Создание приглашений',
  [ROLE_PERMISSIONS.CHANGE_OWN_NICKNAME]: 'Изменить никнейм - свой ник',
  [ROLE_PERMISSIONS.MANAGE_NICKNAMES]: 'Управлять никнеймами - всех',
  [ROLE_PERMISSIONS.KICK_MEMBERS]: 'Удаление участников',
  [ROLE_PERMISSIONS.BAN_MEMBERS]: 'Бан участников',
  [ROLE_PERMISSIONS.SEND_MESSAGES]: 'Отправлять сообщения',
  [ROLE_PERMISSIONS.ATTACH_FILES]: 'Прикреплять файлы',
  [ROLE_PERMISSIONS.MENTION_EVERYONE]: 'Упоминание @everyone',
  [ROLE_PERMISSIONS.MANAGE_MESSAGES]: 'Управление сообщениями',
  [ROLE_PERMISSIONS.SEND_VOICE_MESSAGES]: 'Отправлять голосовые сообщения'
};

export const DEFAULT_ROLE_COLOR = '#99AAB5';
