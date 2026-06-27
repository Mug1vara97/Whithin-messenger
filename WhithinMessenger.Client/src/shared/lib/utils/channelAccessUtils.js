export const parseGuidList = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      const trimmed = value.trim().replace(/^\[|\]$/g, '');
      if (!trimmed) return [];
      return trimmed.split(',').map((part) => part.trim().replace(/^"|"$/g, '')).filter(Boolean);
    }
  }
  return [];
};

export const readPrivateFlag = (obj) => {
  if (obj?.isPrivate === true || obj?.IsPrivate === true) return true;
  if (obj?.isPrivate === false || obj?.IsPrivate === false) return false;
  return false;
};

const readMemberUserId = (member) =>
  member?.userId ?? member?.UserId ?? member?.id ?? member?.Id ?? null;

const readMemberRoleIds = (member) => {
  const roles = member?.roles ?? member?.Roles ?? [];
  return roles
    .map((role) => role?.roleId ?? role?.RoleId ?? role?.id ?? role?.Id)
    .filter(Boolean)
    .map(String);
};

const readChannelMemberIds = (channelMeta) => {
  const members = channelMeta?.members ?? channelMeta?.Members ?? [];
  return members
    .map((entry) => (typeof entry === 'object' ? readMemberUserId(entry) : entry))
    .filter(Boolean)
    .map(String);
};

const normalizeChannelMeta = (channel) => {
  if (!channel) return null;
  return {
    isPrivate: readPrivateFlag(channel),
    allowedRoleIds: channel.allowedRoleIds ?? channel.AllowedRoleIds ?? null,
    members: channel.members ?? channel.Members ?? [],
  };
};

const normalizeCategoryMeta = (category) => {
  if (!category) return null;
  return {
    isPrivate: readPrivateFlag(category),
    allowedRoleIds: category.allowedRoleIds ?? category.AllowedRoleIds ?? null,
    allowedUserIds: category.allowedUserIds ?? category.AllowedUserIds ?? null,
  };
};

export const isChannelPrivate = (channelMeta) => readPrivateFlag(channelMeta);

export const findChannelInServerData = (serverData, chatId) => {
  const resolved = findChannelWithCategory(serverData, chatId);
  return resolved?.channel ?? null;
};

export const findChannelWithCategory = (serverData, chatId) => {
  if (!serverData || chatId == null) return null;

  const categories = serverData.categories ?? serverData.Categories ?? [];
  const targetId = String(chatId);

  for (const category of categories) {
    const chats = category.chats ?? category.Chats ?? [];
    const channel = chats.find(
      (chat) => String(chat.chatId ?? chat.ChatId ?? chat.chat_id) === targetId,
    );
    if (channel) {
      return { channel, category };
    }
  }

  return null;
};

export const buildChannelAccessContext = (serverData, chatId, fallbackChannel = null) => {
  const resolved = findChannelWithCategory(serverData, chatId);
  const channel = resolved?.channel ?? fallbackChannel;
  if (!channel) return null;

  return {
    channel: normalizeChannelMeta(channel),
    category: normalizeCategoryMeta(resolved?.category),
  };
};

export const memberHasCategoryAccess = (member, categoryMeta, serverOwnerId) => {
  const memberUserId = readMemberUserId(member);
  if (memberUserId == null) return false;

  if (serverOwnerId != null && String(memberUserId) === String(serverOwnerId)) {
    return true;
  }

  if (!categoryMeta || !readPrivateFlag(categoryMeta)) {
    return true;
  }

  const allowedRoleIds = parseGuidList(
    categoryMeta.allowedRoleIds ?? categoryMeta.AllowedRoleIds,
  );
  const memberRoleIds = readMemberRoleIds(member);

  if (allowedRoleIds.some((roleId) => memberRoleIds.includes(String(roleId)))) {
    return true;
  }

  const allowedUserIds = parseGuidList(
    categoryMeta.allowedUserIds ?? categoryMeta.AllowedUserIds,
  );
  return allowedUserIds.includes(String(memberUserId));
};

export const memberHasChannelAccess = (
  member,
  channelMeta,
  serverOwnerId,
  categoryMeta = null,
) => {
  const memberUserId = readMemberUserId(member);
  if (memberUserId == null) return false;

  if (serverOwnerId != null && String(memberUserId) === String(serverOwnerId)) {
    return true;
  }

  if (!memberHasCategoryAccess(member, categoryMeta, serverOwnerId)) {
    return false;
  }

  if (!channelMeta || !readPrivateFlag(channelMeta)) {
    return true;
  }

  const allowedRoleIds = parseGuidList(
    channelMeta.allowedRoleIds ?? channelMeta.AllowedRoleIds,
  );
  const memberRoleIds = readMemberRoleIds(member);

  if (allowedRoleIds.some((roleId) => memberRoleIds.includes(String(roleId)))) {
    return true;
  }

  const channelMemberIds = readChannelMemberIds(channelMeta);
  return channelMemberIds.includes(String(memberUserId));
};

export const filterMembersWithChannelAccess = (
  members,
  channelMeta,
  serverOwnerId,
  categoryMeta = null,
) => {
  if (!Array.isArray(members) || members.length === 0) {
    return [];
  }

  return members.filter((member) =>
    memberHasChannelAccess(member, channelMeta, serverOwnerId, categoryMeta),
  );
};
