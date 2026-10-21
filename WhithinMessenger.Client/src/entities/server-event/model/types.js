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
  const opts = { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' };
  const startLabel = start.toLocaleString('ru-RU', opts);
  if (!endsAt) return startLabel;
  const end = new Date(endsAt);
  return `${startLabel} – ${end.toLocaleString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`;
};

export const formatEventDateShort = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
};

export const formatEventTimeShort = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
};

export const toDatetimeLocalValue = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export const toDateInputValue = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export const toTimeInputValue = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export const combineDateAndTime = (dateStr, timeStr) => {
  if (!dateStr || !timeStr) return null;
  const d = new Date(`${dateStr}T${timeStr}`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
};

export const fromDatetimeLocalValue = (value) => {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
};

export const pluralizeEvents = (count) => {
  const n = Math.abs(Number(count) || 0);
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${n} событие`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return `${n} события`;
  return `${n} событий`;
};

export const getEventStatusLabel = (event) => {
  if (!event) return '';
  if (event.status === SERVER_EVENT_STATUS.CANCELED) return 'Отменено';
  const now = Date.now();
  const start = new Date(event.startsAt).getTime();
  const end = event.endsAt
    ? new Date(event.endsAt).getTime()
    : start + 2 * 60 * 60 * 1000;
  if (now >= start && now <= end) return 'Идёт сейчас';
  if (start - now <= 60 * 60 * 1000 && start > now) return 'Скоро начнётся';
  return formatEventWhen(event.startsAt, null);
};

export const getEventLocationLabel = (event) => {
  if (!event) return '';
  if (event.locationType === SERVER_EVENT_LOCATION.EXTERNAL) {
    return event.externalLocation || 'В другом месте';
  }
  if (event.channelName) {
    return event.locationType === SERVER_EVENT_LOCATION.VOICE
      ? event.channelName
      : `#${event.channelName}`;
  }
  return event.locationType === SERVER_EVENT_LOCATION.VOICE
    ? 'Голосовой канал'
    : 'Текстовый канал';
};

export const filterUpcomingEvents = (events = []) => {
  const now = Date.now();
  return events
    .filter((e) => {
      if (e.status === SERVER_EVENT_STATUS.CANCELED) return false;
      const end = e.endsAt
        ? new Date(e.endsAt).getTime()
        : new Date(e.startsAt).getTime() + 2 * 60 * 60 * 1000;
      return end >= now - 60 * 60 * 1000;
    })
    .sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));
};
