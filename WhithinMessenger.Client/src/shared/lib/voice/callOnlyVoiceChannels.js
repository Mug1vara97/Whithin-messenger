const VOICE_TYPE_GUID = '44444444-4444-4444-4444-444444444444';

export const normalizeCategoryId = (id) =>
  id == null || id === 'null' || id === 'undefined' ? null : String(id);

export const getChannelDisplayName = (channel) =>
  channel?.name || channel?.Name || channel?.groupName || channel?.username || null;

export const findChannelInCategories = (categories, channelId) => {
  if (!channelId || !categories?.length) return null;

  const targetId = String(channelId);
  for (const category of categories) {
    const chats = category.chats || category.Chats || [];
    for (let index = 0; index < chats.length; index += 1) {
      const chat = chats[index];
      const id = chat.chatId || chat.ChatId;
      if (String(id) === targetId) {
        return {
          channel: chat,
          category,
          chatOrder: chat.chatOrder ?? chat.ChatOrder ?? index,
        };
      }
    }
  }
  return null;
};

export const buildCallOnlyChannelEntry = (channelId, channelName, placement = {}) => {
  const key = String(channelId);
  const name = channelName || key;

  return {
    chatId: key,
    ChatId: key,
    name,
    Name: name,
    typeId: VOICE_TYPE_GUID,
    chatType: 4,
    chatTypeId: VOICE_TYPE_GUID,
    isCallOnlyChannel: true,
    isPrivate: true,
    categoryId: placement.categoryId ?? null,
    CategoryId: placement.categoryId ?? null,
    categoryName: placement.categoryName ?? null,
    CategoryName: placement.categoryName ?? null,
    categoryOrder: placement.categoryOrder ?? null,
    CategoryOrder: placement.categoryOrder ?? null,
    chatOrder: placement.chatOrder ?? null,
    ChatOrder: placement.chatOrder ?? null,
  };
};

const getCategoryId = (category) =>
  normalizeCategoryId(category?.categoryId ?? category?.CategoryId);

const getCategoryChats = (category) => category?.chats || category?.Chats || [];

const setCategoryChats = (category, chats) => {
  category.chats = chats;
  if (category.Chats) category.Chats = chats;
};

const insertChannelAtOrder = (category, channel, order) => {
  const chats = [...getCategoryChats(category)];
  const insertAt = Number.isFinite(order)
    ? Math.max(0, Math.min(order, chats.length))
    : chats.length;
  chats.splice(insertAt, 0, channel);
  setCategoryChats(category, chats);
};

export const mergeCallOnlyIntoCategories = (categories, callOnlyMap, currentRoomId) => {
  if (!currentRoomId || !callOnlyMap?.size || !categories?.length) {
    return categories;
  }

  const roomId = String(currentRoomId);
  const callOnly = callOnlyMap.get(roomId);
  if (!callOnly) return categories;

  const visibleChannelIds = new Set();
  categories.forEach((category) => {
    getCategoryChats(category).forEach((chat) => {
      const id = chat.chatId || chat.ChatId;
      if (id) visibleChannelIds.add(String(id));
    });
  });

  if (visibleChannelIds.has(roomId)) return categories;

  const merged = categories.map((category) => ({
    ...category,
    chats: [...getCategoryChats(category)],
  }));

  const categoryId = normalizeCategoryId(callOnly.categoryId ?? callOnly.CategoryId);
  const chatOrder = callOnly.chatOrder ?? callOnly.ChatOrder;
  const existingCategory = merged.find((category) => getCategoryId(category) === categoryId);

  if (existingCategory) {
    insertChannelAtOrder(existingCategory, callOnly, chatOrder);
    return merged;
  }

  if (categoryId === null) {
    let nullCategory = merged.find((category) => getCategoryId(category) === null);
    if (!nullCategory) {
      nullCategory = { categoryId: null, categoryName: null, chats: [] };
      merged.unshift(nullCategory);
    }
    insertChannelAtOrder(nullCategory, callOnly, chatOrder);
    return merged;
  }

  merged.push({
    categoryId: callOnly.categoryId ?? callOnly.CategoryId,
    CategoryId: callOnly.categoryId ?? callOnly.CategoryId,
    categoryName: callOnly.categoryName || callOnly.CategoryName || 'Каналы',
    CategoryName: callOnly.categoryName || callOnly.CategoryName || 'Каналы',
    categoryOrder: callOnly.categoryOrder ?? callOnly.CategoryOrder ?? 9999,
    CategoryOrder: callOnly.categoryOrder ?? callOnly.CategoryOrder ?? 9999,
    chats: [callOnly],
    isCallOnlyCategory: true,
  });

  return merged;
};
