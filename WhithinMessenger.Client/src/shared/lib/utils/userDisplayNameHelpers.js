/**
 * Visible name for UI. Login (`username`) stays immutable.
 */
export function resolveUserDisplayName({
  displayName,
  username,
  fallback = 'Пользователь',
} = {}) {
  const nick = displayName?.trim();
  if (nick) return nick;

  const login = username?.trim();
  if (login) return login;

  return fallback;
}

export const DISPLAY_NAME_MAX_LENGTH = 32;
