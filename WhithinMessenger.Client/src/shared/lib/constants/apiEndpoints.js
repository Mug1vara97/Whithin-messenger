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
// Единый SignalR-хаб: все домены (чаты, серверы, друзья, уведомления) на одном соединении.
// Соединение выдаёт ConnectionContext.getConnection(); напрямую HubConnectionBuilder не использовать.
export const HUB_ENDPOINTS = {
  APP_HUB: '/hub',
};

export const BASE_URL = import.meta.env.VITE_API_BASE_URL || 
  (import.meta.env.MODE === 'production' ? '' : 'http://localhost:5109');

// Unified URL for media files (images, videos, audio)
export const MEDIA_BASE_URL = import.meta.env.VITE_API_URL || 
  (import.meta.env.MODE === 'production' ? 'https://whithin.ru' : 'http://localhost:5109');

// Voice server endpoints
export const VOICE_SERVER_URL = import.meta.env.VITE_VOICE_SERVER_URL || 
  (import.meta.env.MODE === 'production' ? 'https://whithin.ru' : 'https://whithin.ru');
export const VOICE_SERVER_CONFIG = {
  transports: ['websocket'],
  upgrade: false,
  rememberUpgrade: false
};
