const pushSection = (items, sectionItems) => {
  if (!sectionItems.length) return;
  if (items.length > 0) {
    items.push({ separator: true });
  }
  items.push(...sectionItems);
};

const buildInviteSubmenuItems = (servers = [], onInviteToServer) => {
  if (typeof onInviteToServer !== 'function') return [];
  if (!servers.length) {
    return [{ text: 'Нет доступных серверов', disabled: true }];
  }

  return servers.map((server) => {
    const serverId = server?.serverId ?? server?.ServerId;
    return {
      text: server?.name || server?.Name || 'Сервер',
      disabled: !serverId,
      onClick: () => onInviteToServer(serverId),
    };
  });
};

const buildMuteSubmenuItems = (onMute) => {
  if (typeof onMute !== 'function') return [];

  return [
    { text: 'На 15 минут', onClick: () => onMute('15m') },
    { text: 'На 1 час', onClick: () => onMute('1h') },
    { text: 'На 8 часов', onClick: () => onMute('8h') },
    { text: 'До тех пор, пока не включу', onClick: () => onMute('until_manual') },
  ];
};

export const buildDmContextMenuItems = ({
  chatId,
  targetUserId,
  targetUsername = 'пользователя',
  hasUnread = false,
  isPinned = false,
  friendAction = null,
  servers = [],
  handlers = {},
}) => {
  const {
    onMarkAsRead,
    onPin,
    onUnpin,
    onProfile,
    onStartCall,
    onInviteToServer,
    onRemoveFriend,
    onIgnore,
    onBlock,
    onMute,
    onCopyUserId,
    onCopyChannelId,
  } = handlers;

  const items = [];
  const displayName = targetUsername || 'пользователя';

  pushSection(items, [
    {
      text: 'Пометить как прочитанное',
      onClick: onMarkAsRead,
      disabled: !hasUnread || typeof onMarkAsRead !== 'function',
    },
    isPinned
      ? {
          text: 'Открепить',
          onClick: onUnpin,
          disabled: typeof onUnpin !== 'function',
        }
      : {
          text: 'Закрепить',
          onClick: onPin,
          disabled: typeof onPin !== 'function',
        },
  ]);

  const profileSection = [];
  if (typeof onProfile === 'function') {
    profileSection.push({ text: 'Профиль', onClick: onProfile });
  }
  if (typeof onStartCall === 'function') {
    profileSection.push({ text: 'Начать звонок', onClick: onStartCall });
  }
  pushSection(items, profileSection);

  const inviteSubmenu = buildInviteSubmenuItems(servers, onInviteToServer);
  if (inviteSubmenu.length > 0) {
    pushSection(items, [
      {
        text: 'Добавить на сервер',
        hasSubmenu: true,
        submenuItems: inviteSubmenu,
      },
    ]);
  }

  if (friendAction && friendAction.kind === 'friend' && typeof onRemoveFriend === 'function') {
    pushSection(items, [
      {
        text: 'Удалить из друзей',
        onClick: onRemoveFriend,
      },
    ]);
  }

  const moderationSection = [];
  if (typeof onIgnore === 'function') {
    moderationSection.push({ text: 'Игнорировать', onClick: onIgnore });
  }
  if (typeof onBlock === 'function') {
    moderationSection.push({ text: 'Заблокировать', onClick: onBlock, danger: true });
  }
  pushSection(items, moderationSection);

  const muteSubmenu = buildMuteSubmenuItems(onMute);
  if (muteSubmenu.length > 0) {
    pushSection(items, [
      {
        text: `Заглушить @${displayName}`,
        hasSubmenu: true,
        submenuItems: muteSubmenu,
      },
    ]);
  }

  const copySection = [];
  if (typeof onCopyUserId === 'function' && targetUserId != null) {
    copySection.push({
      text: 'Копировать ID пользователя',
      onClick: onCopyUserId,
      trailingBadge: 'ID',
    });
  }
  if (typeof onCopyChannelId === 'function' && chatId != null) {
    copySection.push({
      text: 'Копировать ID канала',
      onClick: onCopyChannelId,
      trailingBadge: 'ID',
    });
  }
  pushSection(items, copySection);

  return items;
};
