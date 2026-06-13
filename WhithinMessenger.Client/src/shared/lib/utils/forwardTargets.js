import { serverApi } from '../../../entities/server/api/serverApi';
import apiClient from '../api/apiClient';
import { isIdeasBoardChannel, isVoiceChannel } from '../constants/chatChannelTypes';
import { BASE_URL } from '../constants/apiEndpoints';

export function getMessageForwardPreview(message) {
  if (!message) return '';

  const text = (message.content ?? '').trim();
  if (text) return text;

  if (message.contentType === 'sticker' && message.sticker) {
    return message.sticker.name ? `Стикер: ${message.sticker.name}` : 'Стикер';
  }

  const media = message.mediaFiles ?? [];
  if (media.length > 0) {
    if (media.some((file) => (file.contentType ?? '').startsWith('image/'))) return 'Изображение';
    if (media.some((file) => (file.contentType ?? '').startsWith('video/'))) return 'Видео';
    if (media.some((file) => (file.contentType ?? '').startsWith('audio/'))) return 'Голосовое сообщение';
    return 'Файл';
  }

  return 'Сообщение';
}

export function buildMessageLinkText(message) {
  const sender = message?.senderUsername ?? 'Пользователь';
  const preview = getMessageForwardPreview(message);
  return `https://whithin.ru — ${sender}: ${preview}`;
}

function normalizeId(value) {
  return value == null ? '' : String(value).trim();
}

function extractTextChannels(serverData, serverMeta) {
  const categories = serverData?.categories ?? serverData?.Categories ?? [];
  const serverId = normalizeId(serverMeta?.serverId ?? serverMeta?.ServerId);
  const serverName = serverMeta?.serverName ?? serverMeta?.ServerName ?? serverMeta?.name ?? 'Сервер';
  const serverIconUrl = serverMeta?.serverIconUrl ?? serverMeta?.iconUrl ?? serverMeta?.IconUrl ?? null;

  const channels = [];

  for (const category of categories) {
    const chats = category?.chats ?? category?.Chats ?? [];
    for (const chat of chats) {
      if (isVoiceChannel(chat) || isIdeasBoardChannel(chat)) continue;

      const chatId = normalizeId(chat?.chatId ?? chat?.ChatId);
      if (!chatId) continue;

      const channelName = chat?.name ?? chat?.Name ?? chat?.channelName ?? chat?.ChannelName ?? 'канал';
      channels.push({
        type: 'channel',
        chatId,
        title: `# ${channelName}`,
        subtitle: serverName,
        channelName,
        serverId,
        serverName,
        serverIconUrl,
        searchText: `${channelName} ${serverName}`.toLowerCase(),
      });
    }
  }

  return channels;
}

export async function loadForwardChannelTargets(servers = []) {
  if (!Array.isArray(servers) || servers.length === 0) return [];

  const batches = await Promise.all(
    servers.map(async (server) => {
      const serverId = server?.serverId ?? server?.ServerId;
      if (!serverId) return [];

      try {
        const data = await serverApi.getServerById(serverId);
        return extractTextChannels(data, server);
      } catch (error) {
        console.error('loadForwardChannelTargets: failed for server', serverId, error);
        return [];
      }
    }),
  );

  return batches.flat();
}

export async function loadForwardDirectChats() {
  const response = await apiClient.get('/Chat/user-chats');
  return Array.isArray(response.data) ? response.data : [];
}

export function buildForwardListItems({ chats = [], channelTargets = [], currentChatId = '' }) {
  const currentId = normalizeId(currentChatId).toLowerCase();

  const channels = channelTargets
    .filter((target) => {
      const id = normalizeId(target.chatId).toLowerCase();
      return id && id !== currentId;
    })
    .map((target) => ({
      ...target,
      type: 'channel',
      chatId: normalizeId(target.chatId),
      title: target.title ?? `# ${target.channelName}`,
      subtitle: target.subtitle ?? target.serverName,
    }));

  const serverChannelIds = new Set(channels.map((item) => item.chatId.toLowerCase()));

  const directMessages = chats
    .map((chat) => {
      const chatId = normalizeId(chat?.chatId ?? chat?.ChatId);
      if (!chatId || chatId.toLowerCase() === currentId) return null;
      if (serverChannelIds.has(chatId.toLowerCase())) return null;

      const title = chat?.username
        ?? chat?.groupName
        ?? chat?.GroupName
        ?? (chat?.isGroupChat || chat?.IsGroupChat ? 'Группа' : 'Чат');

      const lastMessage = chat?.lastMessage ?? chat?.LastMessage ?? '';

      return {
        type: 'dm',
        chatId,
        title,
        subtitle: lastMessage,
        avatarUrl: chat?.avatarUrl ?? chat?.AvatarUrl ?? null,
        avatarColor: chat?.avatarColor ?? chat?.AvatarColor ?? null,
        isGroup: Boolean(chat?.isGroupChat ?? chat?.IsGroupChat),
        searchText: `${title} ${lastMessage}`.toLowerCase(),
      };
    })
    .filter(Boolean);

  return [...channels, ...directMessages];
}

export function resolveServerIconUrl(iconUrl) {
  const raw = (iconUrl ?? '').trim();
  if (!raw) return null;
  if (raw.startsWith('http')) return raw;
  if (raw.startsWith('/')) return `${BASE_URL}${raw}`;
  return `${BASE_URL}/uploads/${raw}`;
}
