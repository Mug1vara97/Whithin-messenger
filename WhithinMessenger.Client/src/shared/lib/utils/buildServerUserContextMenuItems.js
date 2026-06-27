const pushSection = (items, sectionItems) => {
  if (!sectionItems.length) return;
  if (items.length > 0) {
    items.push({ separator: true });
  }
  items.push(...sectionItems);
};

export const buildServerUserContextMenuItems = ({
  targetUserId,
  currentUserId,
  friendAction,
  isServerContext = false,
  canEditNickname = false,
  canManageRoles = false,
  canKick = false,
  handlers = {},
}) => {
  const {
    onProfile,
    onMessage,
    onAddFriend,
    onAcceptFriend,
    onRemoveFriend,
    onEditNickname,
    onManageRoles,
    onKick,
    onCopyId,
  } = handlers;

  const items = [];
  const isSelf = String(targetUserId) === String(currentUserId);

  if (isSelf) {
    pushSection(items, typeof onProfile === 'function' ? [{ text: 'Профиль', onClick: onProfile }] : []);

    if (isServerContext && canEditNickname && typeof onEditNickname === 'function') {
      pushSection(items, [
        {
          text: 'Редактировать личный профиль сервера',
          onClick: onEditNickname,
        },
      ]);
    }

    if (isServerContext && canManageRoles && typeof onManageRoles === 'function') {
      pushSection(items, [
        {
          text: 'Роли',
          onClick: onManageRoles,
          hasSubmenu: true,
        },
      ]);
    }

    if (typeof onCopyId === 'function') {
      pushSection(items, [
        {
          text: 'Копировать ID пользователя',
          onClick: onCopyId,
          trailingBadge: 'ID',
        },
      ]);
    }

    return items;
  }

  const primarySection = [];
  if (typeof onProfile === 'function') {
    primarySection.push({ text: 'Профиль', onClick: onProfile });
  }
  const canMessage =
    typeof onMessage === 'function' &&
    (!isServerContext || friendAction?.kind === 'friend');
  if (canMessage) {
    primarySection.push({ text: 'Написать сообщение', onClick: onMessage });
  }
  pushSection(items, primarySection);

  if (friendAction && friendAction.kind !== 'self') {
    const friendSection = [];
    if (friendAction.kind === 'friend' && typeof onRemoveFriend === 'function') {
      friendSection.push({
        text: 'Удалить из друзей',
        onClick: onRemoveFriend,
        danger: true,
      });
    } else if (friendAction.kind === 'incoming' && typeof onAcceptFriend === 'function') {
      friendSection.push({
        text: 'Принять запрос в друзья',
        onClick: () => onAcceptFriend(friendAction.requestId),
      });
    } else if (friendAction.kind === 'outgoing') {
      friendSection.push({ text: 'Запрос отправлен', disabled: true });
    } else if (friendAction.kind === 'stranger' && typeof onAddFriend === 'function') {
      friendSection.push({ text: 'Добавить в друзья', onClick: onAddFriend });
    }
    pushSection(items, friendSection);
  }

  if (isServerContext) {
    const serverSection = [];
    if (canEditNickname && typeof onEditNickname === 'function') {
      serverSection.push({
        text: 'Серверный ник',
        onClick: onEditNickname,
      });
    }
    if (canManageRoles && typeof onManageRoles === 'function') {
      serverSection.push({
        text: 'Роли',
        onClick: onManageRoles,
        hasSubmenu: true,
      });
    }
    if (canKick && typeof onKick === 'function') {
      serverSection.push({
        text: 'Удалить с сервера',
        onClick: onKick,
        danger: true,
      });
    }
    pushSection(items, serverSection);
  }

  if (typeof onCopyId === 'function') {
    pushSection(items, [
      {
        text: 'Копировать ID пользователя',
        onClick: onCopyId,
        trailingBadge: 'ID',
      },
    ]);
  }

  return items;
};
