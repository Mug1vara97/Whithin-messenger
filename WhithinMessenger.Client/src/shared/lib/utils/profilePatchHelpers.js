import { buildMediaUrl } from './urlHelpers';

const pick = (obj, ...keys) => {
  for (const key of keys) {
    const value = obj?.[key];
    if (value !== undefined) return value;
  }
  return undefined;
};

export const normalizeProfilePayload = (payload) => {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const userId = pick(payload, 'userId', 'UserId');
  if (!userId) {
    return null;
  }

  const avatar = pick(payload, 'avatar', 'Avatar');
  const normalizedAvatar = avatar === undefined
    ? undefined
    : (avatar ? (buildMediaUrl(avatar) || avatar) : null);

  return {
    userId,
    username: pick(payload, 'username', 'Username'),
    displayName: pick(payload, 'displayName', 'DisplayName'),
    avatar: normalizedAvatar,
    avatarColor: pick(payload, 'avatarColor', 'AvatarColor'),
    description: pick(payload, 'description', 'Description'),
    banner: pick(payload, 'banner', 'Banner'),
    nameplate: pick(payload, 'nameplate', 'Nameplate'),
    avatarDecoration: pick(payload, 'avatarDecoration', 'AvatarDecoration'),
  };
};

export const resolveProfileDisplayLabel = (patch) =>
  patch?.displayName ?? patch?.username ?? undefined;

const matchesUserId = (entityUserId, patchUserId) =>
  entityUserId != null &&
  patchUserId != null &&
  String(entityUserId) === String(patchUserId);

export const patchFriendWithProfile = (friend, patch) => {
  if (!friend || !patch?.userId || !matchesUserId(friend.userId, patch.userId)) {
    return friend;
  }

  const label = resolveProfileDisplayLabel(patch);
  return {
    ...friend,
    ...(label !== undefined ? { username: label } : {}),
    ...(patch.avatar !== undefined ? { avatar: patch.avatar } : {}),
    ...(patch.avatarColor !== undefined ? { avatarColor: patch.avatarColor } : {}),
    ...(patch.description !== undefined ? { description: patch.description } : {}),
  };
};

export const patchChatListItemWithProfile = (chat, patch) => {
  if (!chat || !patch?.userId) {
    return chat;
  }

  const isGroupChat = Boolean(chat.isGroupChat ?? chat.IsGroupChat);
  const isSavedMessages = Boolean(chat.isSavedMessages ?? chat.IsSavedMessages);
  if (isGroupChat || isSavedMessages) {
    return chat;
  }

  if (!matchesUserId(chat.userId ?? chat.UserId, patch.userId)) {
    return chat;
  }

  const label = resolveProfileDisplayLabel(patch);
  return {
    ...chat,
    ...(label !== undefined ? { username: label } : {}),
    ...(patch.avatar !== undefined ? { avatarUrl: patch.avatar } : {}),
    ...(patch.avatarColor !== undefined ? { avatarColor: patch.avatarColor } : {}),
    ...(patch.nameplate !== undefined ? { nameplate: patch.nameplate } : {}),
    ...(patch.avatarDecoration !== undefined ? { avatarDecoration: patch.avatarDecoration } : {}),
  };
};

export const patchParticipantWithProfile = (participant, patch) => {
  if (!participant || !patch?.userId || !matchesUserId(participant.userId, patch.userId)) {
    return participant;
  }

  const label = resolveProfileDisplayLabel(patch);
  return {
    ...participant,
    ...(label !== undefined ? { username: label } : {}),
    ...(patch.avatar !== undefined ? { avatarUrl: patch.avatar } : {}),
    ...(patch.avatarColor !== undefined ? { avatarColor: patch.avatarColor } : {}),
    ...(patch.avatarDecoration !== undefined ? { avatarDecoration: patch.avatarDecoration } : {}),
    ...(patch.nameplate !== undefined ? { nameplate: patch.nameplate } : {}),
  };
};

export const patchChatUserProfileWithProfile = (profile, patch) => {
  if (!patch?.userId) {
    return profile;
  }

  const profileUserId = profile?.userId ?? profile?.otherUserId ?? profile?.UserId ?? profile?.OtherUserId;
  if (profile && !matchesUserId(profileUserId, patch.userId)) {
    return profile;
  }

  const label = resolveProfileDisplayLabel(patch);
  return {
    ...(profile || {}),
    ...(label !== undefined ? { username: label } : {}),
    ...(patch.avatar !== undefined ? { avatar: patch.avatar } : {}),
    ...(patch.avatarColor !== undefined ? { avatarColor: patch.avatarColor } : {}),
    ...(patch.avatarDecoration !== undefined ? { avatarDecoration: patch.avatarDecoration } : {}),
    ...(patch.banner !== undefined ? { banner: patch.banner } : {}),
    ...(patch.description !== undefined ? { description: patch.description } : {}),
    ...(patch.nameplate !== undefined ? { nameplate: patch.nameplate } : {}),
  };
};

export const patchMemberWithProfile = (member, patch) => {
  if (!member || !patch?.userId || !matchesUserId(member.userId, patch.userId)) {
    return member;
  }

  const label = resolveProfileDisplayLabel(patch);
  return {
    ...member,
    ...(label !== undefined ? { username: label } : {}),
    ...(patch.avatar !== undefined ? { avatar: patch.avatar, avatarUrl: patch.avatar } : {}),
    ...(patch.avatarColor !== undefined ? { avatarColor: patch.avatarColor } : {}),
    ...(patch.avatarDecoration !== undefined ? { avatarDecoration: patch.avatarDecoration } : {}),
    ...(patch.nameplate !== undefined ? { nameplate: patch.nameplate } : {}),
    ...(patch.banner !== undefined ? { banner: patch.banner } : {}),
    ...(patch.description !== undefined ? { description: patch.description } : {}),
  };
};

export const patchMessageWithProfile = (message, patch) => {
  if (!message || !patch?.userId) {
    return message;
  }

  const senderId =
    message.userId ??
    message.UserId ??
    message.senderId ??
    message.SenderId;

  if (!matchesUserId(senderId, patch.userId)) {
    return message;
  }

  const label = resolveProfileDisplayLabel(patch);
  return {
    ...message,
    ...(label !== undefined ? { username: label, displayName: patch.displayName ?? label } : {}),
    ...(patch.avatar !== undefined ? { avatarUrl: patch.avatar } : {}),
    ...(patch.avatarColor !== undefined ? { avatarColor: patch.avatarColor } : {}),
    ...(patch.avatarDecoration !== undefined ? { avatarDecoration: patch.avatarDecoration } : {}),
  };
};

export const mergeProfileState = (prev, patch) => {
  if (!patch) {
    return prev;
  }

  const next = { ...(prev || {}) };
  Object.entries(patch).forEach(([key, value]) => {
    if (value !== undefined) {
      next[key] = value;
    }
  });
  return next;
};
