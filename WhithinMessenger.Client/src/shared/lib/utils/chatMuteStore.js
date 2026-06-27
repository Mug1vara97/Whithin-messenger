const STORAGE_KEY = 'whithin:muted-chats';

const readStore = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

const writeStore = (store) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    window.dispatchEvent(new CustomEvent('chatMuteChanged'));
  } catch {
    // ignore quota errors
  }
};

const normalizeEntry = (value) => {
  if (value === 'forever' || value === null) {
    return { mutedUntil: null };
  }

  const mutedUntil = Number(value);
  if (!Number.isFinite(mutedUntil)) {
    return null;
  }

  return { mutedUntil };
};

export const parseMuteDurationMs = (durationKey) => {
  const now = Date.now();
  switch (durationKey) {
    case '15m':
      return now + 15 * 60 * 1000;
    case '1h':
      return now + 60 * 60 * 1000;
    case '8h':
      return now + 8 * 60 * 60 * 1000;
    case 'until_manual':
      return null;
    default:
      return now + 60 * 60 * 1000;
  }
};

export const muteChat = (chatId, durationKey) => {
  if (!chatId) return;
  const store = readStore();
  const mutedUntil = parseMuteDurationMs(durationKey);
  store[String(chatId)] = mutedUntil == null ? 'forever' : mutedUntil;
  writeStore(store);
};

export const unmuteChat = (chatId) => {
  if (!chatId) return;
  const store = readStore();
  delete store[String(chatId)];
  writeStore(store);
};

export const isChatMuted = (chatId) => {
  if (!chatId) return false;
  const store = readStore();
  const entry = normalizeEntry(store[String(chatId)]);
  if (!entry) return false;
  if (entry.mutedUntil == null) return true;
  if (entry.mutedUntil > Date.now()) return true;
  unmuteChat(chatId);
  return false;
};

export const getMutedChatIds = () => {
  const store = readStore();
  return Object.keys(store).filter((chatId) => isChatMuted(chatId));
};
