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

/** Letter for avatar placeholder: global nick only, never server nick or resolved visible name. */
export function resolveAvatarInitial({
  displayName,
  login,
  fallback = '?',
} = {}) {
  const nick = displayName?.trim();
  if (nick) return nick.charAt(0).toUpperCase();

  const log = login?.trim();
  if (log) return log.charAt(0).toUpperCase();

  const legacy = fallback?.trim();
  if (legacy) return legacy.charAt(0).toUpperCase();

  return '?';
}

export const DISPLAY_NAME_MAX_LENGTH = 32;

/** Avatar letter source from a chat message, optionally enriched from server members. */
export function resolveMessageAvatarIdentity(message, serverMembers = []) {
  const displayName =
    message?.senderDisplayName ??
    message?.SenderDisplayName ??
    null;
  const login =
    message?.senderLogin ??
    message?.SenderLogin ??
    null;

  if (displayName?.trim() || login?.trim()) {
    return { displayName, login };
  }

  const senderId = message?.senderId ?? message?.SenderId;
  if (senderId == null) {
    return { displayName: null, login: null };
  }

  const member = serverMembers.find(
    (item) => String(item.userId ?? item.UserId) === String(senderId),
  );
  if (!member) {
    return { displayName: null, login: null };
  }

  return {
    displayName: member.displayName ?? member.DisplayName ?? null,
    login: member.login ?? member.Login ?? null,
  };
}
