import {
  DEFAULT_EMOJI_CATEGORIES,
  MAX_RECENT_EMOJIS,
  RECENT_EMOJIS_STORAGE_KEY,
} from '../data/defaultEmojiCategories';

const allDefaultEmojis = new Set(
  DEFAULT_EMOJI_CATEGORIES.flatMap((category) => category.emojis),
);

export const getRecentEmojis = () => {
  try {
    const raw = localStorage.getItem(RECENT_EMOJIS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((emoji) => typeof emoji === 'string' && allDefaultEmojis.has(emoji));
  } catch {
    return [];
  }
};

export const rememberRecentEmoji = (emoji) => {
  if (!emoji || !allDefaultEmojis.has(emoji)) return getRecentEmojis();
  const updated = [emoji, ...getRecentEmojis().filter((item) => item !== emoji)].slice(
    0,
    MAX_RECENT_EMOJIS,
  );
  try {
    localStorage.setItem(RECENT_EMOJIS_STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // ignore quota errors
  }
  return updated;
};
