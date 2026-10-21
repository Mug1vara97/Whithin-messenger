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

  const next = { userId };
  const assign = (key, value) => {
    if (value !== undefined) {
      next[key] = value;
    }
  };

  assign('username', pick(payload, 'username', 'Username'));
  assign('displayName', pick(payload, 'displayName', 'DisplayName'));
  assign('avatar', normalizedAvatar);
  assign('avatarColor', pick(payload, 'avatarColor', 'AvatarColor'));
  assign('description', pick(payload, 'description', 'Description'));
  assign('banner', pick(payload, 'banner', 'Banner'));
  assign('nameplate', pick(payload, 'nameplate', 'Nameplate'));
  assign('avatarDecoration', pick(payload, 'avatarDecoration', 'AvatarDecoration'));
  assign('status', pick(payload, 'status', 'Status'));
  assign('createdAt', pick(payload, 'createdAt', 'CreatedAt'));
  assign('isBot', pick(payload, 'isBot', 'IsBot'));
  assign('changedFields', pick(payload, 'changedFields', 'ChangedFields'));

  return next;
};

export const resolveProfileDisplayLabel = (patch) =>
  patch?.displayName ?? patch?.username ?? undefined;

const matchesUserId = (entityUserId, patchUserId) =>
  entityUserId != null &&
  patchUserId != null &&
  String(entityUserId) === String(patchUserId);

const changedFieldsInclude = (patch, field) => {
  const fields = Array.isArray(patch?.changedFields)
    ? patch.changedFields
    : Array.isArray(patch?.ChangedFields)
      ? patch.ChangedFields
      : null;
  if (!fields || fields.length === 0) return false;
  const needle = String(field).toLowerCase();
  return fields.some((item) => String(item).toLowerCase() === needle);
};

const resolvePatchDescription = (patch) => {
  if (!patch) return undefined;
  if (patch.description !== undefined) return patch.description;
  if (patch.Description !== undefined) return patch.Description;
  return undefined;
};

/** Apply description from a profile patch without wiping a known about-me on soft loads. */
export const applyDescriptionPatch = (currentDescription, patch) => {
  const incoming = resolvePatchDescription(patch);
  if (incoming === undefined) {
    return currentDescription;
  }

  const incomingText = incoming == null ? '' : String(incoming).trim();
  const descriptionExplicitlyChanged = changedFieldsInclude(patch, 'description');

  if (descriptionExplicitlyChanged) {
    return incomingText;
  }

  // Soft updates (profile-load, avatar, etc.) must not clear an existing about-me.
  if (!incomingText) {
    return currentDescription;
  }

  return incomingText;
};

export const patchFriendWithProfile = (friend, patch) => {
  if (!friend || !patch?.userId || !matchesUserId(friend.userId, patch.userId)) {
    return friend;
  }

  const label = resolveProfileDisplayLabel(patch);
  const nextDescription = applyDescriptionPatch(friend.description, patch);
  return {
    ...friend,
    ...(label !== undefined ? { username: label } : {}),
    ...(patch.avatar !== undefined ? { avatar: patch.avatar } : {}),
    ...(patch.avatarColor !== undefined ? { avatarColor: patch.avatarColor } : {}),
    ...(nextDescription !== friend.description ? { description: nextDescription } : {}),
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
  const currentDescription = profile?.description ?? profile?.Description;
  const nextDescription = applyDescriptionPatch(currentDescription, patch);
  return {
    ...(profile || {}),
    ...(label !== undefined ? { username: label } : {}),
    ...(patch.avatar !== undefined ? { avatar: patch.avatar } : {}),
    ...(patch.avatarColor !== undefined ? { avatarColor: patch.avatarColor } : {}),
    ...(patch.avatarDecoration !== undefined ? { avatarDecoration: patch.avatarDecoration } : {}),
    ...(patch.banner !== undefined ? { banner: patch.banner } : {}),
    ...(nextDescription !== currentDescription ? { description: nextDescription } : {}),
    ...(patch.nameplate !== undefined ? { nameplate: patch.nameplate } : {}),
  };
};

export const patchMemberWithProfile = (member, patch) => {
  if (!member || !patch?.userId || !matchesUserId(member.userId, patch.userId)) {
    return member;
  }

  const label = resolveProfileDisplayLabel(patch);
  const nextDescription = applyDescriptionPatch(member.description, patch);
  return {
    ...member,
    ...(label !== undefined ? { username: label } : {}),
    ...(patch.avatar !== undefined ? { avatar: patch.avatar, avatarUrl: patch.avatar } : {}),
    ...(patch.avatarColor !== undefined ? { avatarColor: patch.avatarColor } : {}),
    ...(patch.avatarDecoration !== undefined ? { avatarDecoration: patch.avatarDecoration } : {}),
    ...(patch.nameplate !== undefined ? { nameplate: patch.nameplate } : {}),
    ...(patch.isBot !== undefined ? { isBot: Boolean(patch.isBot) } : {}),
    ...(patch.banner !== undefined ? { banner: patch.banner } : {}),
    ...(nextDescription !== member.description ? { description: nextDescription } : {}),
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
