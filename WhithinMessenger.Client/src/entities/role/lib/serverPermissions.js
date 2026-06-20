export const isServerOwner = (server, userId) => {
  if (!server || userId == null) return false;
  const ownerId = server.ownerId ?? server.OwnerId;
  return String(ownerId) === String(userId);
};

export const hasServerPermission = (permissions, isOwner, permission) => {
  if (isOwner) return true;
  return permissions?.[permission] === true;
};

export const canManageChannels = (permissions, isOwner) =>
  hasServerPermission(permissions, isOwner, 'manageChannels');

export const canManageRoles = (permissions, isOwner) =>
  hasServerPermission(permissions, isOwner, 'manageRoles');

export const canManageServer = (permissions, isOwner) =>
  hasServerPermission(permissions, isOwner, 'manageServer');

export const canKickMembers = (permissions, isOwner) =>
  hasServerPermission(permissions, isOwner, 'kickMembers');

export const canMuteMembers = (permissions, isOwner) =>
  hasServerPermission(permissions, isOwner, 'muteMembers');

export const canCreateInvites = (permissions, isOwner) =>
  hasServerPermission(permissions, isOwner, 'createInvites');

export const canSendMessages = (permissions, isOwner) =>
  hasServerPermission(permissions, isOwner, 'sendMessages');

export const canAttachFiles = (permissions, isOwner) =>
  hasServerPermission(permissions, isOwner, 'attachFiles');

export const canSendVoiceMessages = (permissions, isOwner) =>
  hasServerPermission(permissions, isOwner, 'sendVoiceMessages');

export const canManageMessages = (permissions, isOwner) =>
  hasServerPermission(permissions, isOwner, 'manageMessages');

export const canChangeOwnNickname = (permissions, isOwner) =>
  hasServerPermission(permissions, isOwner, 'changeOwnNickname');

export const canManageNicknames = (permissions, isOwner) =>
  hasServerPermission(permissions, isOwner, 'manageNicknames');

export const canEditServerMemberNickname = (permissions, isOwner, currentUserId, memberUserId) => {
  const isSelf = String(memberUserId) === String(currentUserId);
  if (isSelf) return canChangeOwnNickname(permissions, isOwner);
  return canManageNicknames(permissions, isOwner);
};

export const getServerPermissions = (server) =>
  server?.permissions ?? server?.Permissions ?? {};
