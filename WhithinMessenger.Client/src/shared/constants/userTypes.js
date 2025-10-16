// Типы для пользователя
export const UserStatus = {
  ONLINE: 'online',
  OFFLINE: 'offline',
  AWAY: 'away',
  BUSY: 'busy'
};

export const UserRole = {
  USER: 'user',
  ADMIN: 'admin',
  MODERATOR: 'moderator'
};

// Типы для аутентификации
export const AuthStatus = {
  AUTHENTICATED: 'authenticated',
  UNAUTHENTICATED: 'unauthenticated',
  LOADING: 'loading'
};

export const LoginCredentials = {
  username: '',
  password: ''
};

export const RegisterData = {
  username: '',
  password: '',
  confirmPassword: ''
};

export const User = {
  userId: null,
  username: '',
  status: UserStatus.OFFLINE,
  role: UserRole.USER,
  avatarUrl: null,
  createdAt: null,
  lastSeen: null
};
