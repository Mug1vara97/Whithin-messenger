export const SERVER_EVENT_LOCATION = {
  VOICE: 'VoiceChannel',
  TEXT: 'TextChannel',
  EXTERNAL: 'External',
};

export const SERVER_EVENT_STATUS = {
  SCHEDULED: 'Scheduled',
  CANCELED: 'Canceled',
};

export const SERVER_EVENT_INTEREST = {
  INTERESTED: 'Interested',
  GOING: 'Going',
};

export const TEXT_CHANNEL_TYPE_ID = '33333333-3333-3333-3333-333333333333';
export const VOICE_CHANNEL_TYPE_ID = '44444444-4444-4444-4444-444444444444';

export const normalizeServerEvent = (raw) => {
  if (!raw) return null;
  return {
    eventId: raw.eventId ?? raw.EventId,
    serverId: raw.serverId ?? raw.ServerId,
    createdByUserId: raw.createdByUserId ?? raw.CreatedByUserId,
    createdByUsername: raw.createdByUsername ?? raw.CreatedByUsername ?? '',
    title: raw.title ?? raw.Title ?? '',
    description: raw.description ?? raw.Description ?? '',
    startsAt: raw.startsAt ?? raw.StartsAt,
    endsAt: raw.endsAt ?? raw.EndsAt ?? null,
    locationType: raw.locationType ?? raw.LocationType,
    channelId: raw.channelId ?? raw.ChannelId ?? null,
    channelName: raw.channelName ?? raw.ChannelName ?? null,
    externalLocation: raw.externalLocation ?? raw.ExternalLocation ?? null,
    status: raw.status ?? raw.Status,
    interestedCount: raw.interestedCount ?? raw.InterestedCount ?? 0,
    goingCount: raw.goingCount ?? raw.GoingCount ?? 0,
    myInterest: raw.myInterest ?? raw.MyInterest ?? null,
    createdAt: raw.createdAt ?? raw.CreatedAt,
    updatedAt: raw.updatedAt ?? raw.UpdatedAt,
  };
};

export const getChannelTypeId = (chat) =>
  String(chat?.typeId ?? chat?.TypeId ?? '');

export const isTextChannel = (chat) => {
  const t = getChannelTypeId(chat);
  return t === TEXT_CHANNEL_TYPE_ID || t === '3';
};

export const isVoiceChannel = (chat) => {
  const t = getChannelTypeId(chat);
  return t === VOICE_CHANNEL_TYPE_ID || t === '4';
};

export const collectServerChannels = (categories = []) => {
  const channels = [];
  for (const category of categories) {
    const chats = category.chats || category.Chats || [];
    for (const chat of chats) {
      channels.push({
        chatId: chat.chatId ?? chat.ChatId,
        name: chat.name ?? chat.Name ?? 'канал',
        typeId: chat.typeId ?? chat.TypeId,
      });
    }
  }
  return channels;
};

export const formatEventWhen = (startsAt, endsAt) => {
  if (!startsAt) return '';
  const start = new Date(startsAt);
  const opts = { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' };
  const startLabel = start.toLocaleString('ru-RU', opts);
  if (!endsAt) return startLabel;
  const end = new Date(endsAt);
  return `${startLabel} – ${end.toLocaleString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`;
};

export const toDatetimeLocalValue = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export const fromDatetimeLocalValue = (value) => {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
};
