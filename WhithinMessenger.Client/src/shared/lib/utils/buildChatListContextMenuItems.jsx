import { buildDmContextMenuItems } from './buildDmContextMenuItems';

const pushSection = (items, sectionItems) => {
  if (!sectionItems.length) return;
  if (items.length > 0) {
    items.push({ separator: true });
  }
  items.push(...sectionItems);
};

export const buildGroupChatListContextMenuItems = ({
  chatId,
  hasUnread = false,
  isPinned = false,
  handlers = {},
}) => {
  const { onMarkAsRead, onPin, onUnpin, onCopyChannelId } = handlers;
  const items = [];

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

  if (typeof onCopyChannelId === 'function' && chatId != null) {
    pushSection(items, [
      {
        text: 'Копировать ID канала',
        onClick: onCopyChannelId,
        trailingBadge: 'ID',
      },
    ]);
  }

  return items;
};

export const buildChatListContextMenuItems = (options) => {
  const { chat, isPinned: isPinnedProp, ...rest } = options;
  const isGroupChat = Boolean(chat?.isGroupChat ?? chat?.IsGroupChat);
  const isSavedMessages = Boolean(chat?.isSavedMessages ?? chat?.IsSavedMessages);
  const isPinned = isPinnedProp ?? Boolean(chat?.isPinned ?? chat?.IsPinned);

  if (isSavedMessages) {
    return [];
  }

  if (isGroupChat) {
    return buildGroupChatListContextMenuItems({ ...rest, isPinned });
  }

  return buildDmContextMenuItems({ ...rest, isPinned });
};
