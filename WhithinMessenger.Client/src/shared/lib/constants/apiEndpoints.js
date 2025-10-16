export const API_ENDPOINTS = {
  // Auth endpoints
  LOGIN: '/api/auth/login',
  REGISTER: '/api/auth/register',
  LOGOUT: '/api/auth/logout',
  REFRESH_TOKEN: '/api/auth/refresh',
  
  // User endpoints
  USER_PROFILE: '/api/user/profile',
  USER_SETTINGS: '/api/user/settings',
  USER_STATUS: '/api/user/status',
  
  // Chat endpoints
  CHATS: '/api/chats',
  CHAT_MESSAGES: (chatId) => `/api/chats/${chatId}/messages`,
  CREATE_CHAT: '/api/chats/create',
  
  // Server endpoints
  SERVERS: '/api/messages/servers',
  SERVER_CHANNELS: (serverId) => `/api/servers/${serverId}/channels`,
  SERVER_DETAILS: (serverId) => `/api/messages/servers/${serverId}`,
  
  // Voice endpoints
  VOICE_CHANNELS: '/api/voice-channels',
  JOIN_VOICE: '/api/voice/join',
  LEAVE_VOICE: '/api/voice/leave',
  
  // Notification endpoints
  NOTIFICATIONS: '/api/notifications',
  NOTIFICATION_SETTINGS: '/api/notifications/settings',
  
  // Media endpoints
  UPLOAD_MEDIA: '/api/media/upload',
  DELETE_MEDIA: (mediaId) => `/api/media/${mediaId}`,
};

// SignalR Hub endpoints
export const HUB_ENDPOINTS = {
  SERVER_HUB: '/serverhub',
  CHAT_LIST_HUB: '/chatlisthub',
  GROUP_CHAT_HUB: '/groupchathub',
  STATUS_HUB: '/statushub',
  NOTIFICATION_HUB: '/notificationhub',
};

// В production (через nginx) используем пустую строку для относительных путей
// В development используем прямой URL к бэкенду
export const BASE_URL = import.meta.env.VITE_API_BASE_URL || 
  (import.meta.env.MODE === 'production' ? '' : 'http://localhost:5109');
