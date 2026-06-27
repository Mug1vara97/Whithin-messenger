import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Close, History } from '@mui/icons-material';
import { DEFAULT_EMOJI_CATEGORIES } from '../../../lib/data/defaultEmojiCategories';
import { getRecentEmojis, rememberRecentEmoji } from '../../../lib/utils/recentEmojis';
import './EmojiPicker.css';

const RECENT_CATEGORY_ID = 'recent';

const EmojiPicker = ({ open = true, embedded = false, onClose, onEmojiSelect }) => {
  const [recentEmojis, setRecentEmojis] = useState(() => getRecentEmojis());
  const [activeCategoryId, setActiveCategoryId] = useState(
    recentEmojis.length > 0 ? RECENT_CATEGORY_ID : DEFAULT_EMOJI_CATEGORIES[0]?.id,
  );

  useEffect(() => {
    if (!embedded && !open) return;
    const latestRecent = getRecentEmojis();
    setRecentEmojis(latestRecent);
    setActiveCategoryId((current) => {
      if (current === RECENT_CATEGORY_ID && latestRecent.length === 0) {
        return DEFAULT_EMOJI_CATEGORIES[0]?.id ?? RECENT_CATEGORY_ID;
      }
      return current;
    });
  }, [embedded, open]);

  const categories = useMemo(() => {
    const items = [...DEFAULT_EMOJI_CATEGORIES];
    if (recentEmojis.length > 0) {
      items.unshift({
        id: RECENT_CATEGORY_ID,
        label: 'Недавние',
        icon: null,
        emojis: recentEmojis,
      });
    }
    return items;
  }, [recentEmojis]);

  const activeCategory = useMemo(
    () => categories.find((category) => category.id === activeCategoryId) ?? categories[0],
    [activeCategoryId, categories],
  );

  const handleEmojiClick = useCallback(
    (emoji) => {
      const updatedRecent = rememberRecentEmoji(emoji);
      setRecentEmojis(updatedRecent);
      onEmojiSelect?.(emoji);
    },
    [onEmojiSelect],
  );

  if (!embedded && !open) {
    return null;
  }

  const categoryTabs = (
    <div
      className={`emoji-picker__categories${embedded ? ' emoji-picker__categories--inline' : ''}`}
      role="tablist"
      aria-label="Категории эмодзи"
    >
      {categories.map((category) => (
        <button
          key={category.id}
          type="button"
          role="tab"
          aria-selected={activeCategoryId === category.id}
          className={`emoji-picker__category${activeCategoryId === category.id ? ' emoji-picker__category--active' : ''}`}
          onClick={() => setActiveCategoryId(category.id)}
          title={category.label}
        >
          {category.id === RECENT_CATEGORY_ID ? (
            <History sx={{ fontSize: 20 }} />
          ) : (
            <span className="emoji-picker__category-icon" aria-hidden="true">
              {category.icon}
            </span>
          )}
        </button>
      ))}
    </div>
  );

  const emojiGrid = (
    <div className="emoji-picker__grid" role="listbox" aria-label={activeCategory?.label}>
      {activeCategory?.emojis?.map((emoji) => (
        <button
          key={`${activeCategory.id}-${emoji}`}
          type="button"
          className="emoji-picker__emoji"
          onClick={() => handleEmojiClick(emoji)}
          aria-label={emoji}
          title={emoji}
        >
          {emoji}
        </button>
      ))}
    </div>
  );

  if (embedded) {
    return (
      <div className="emoji-picker emoji-picker--embedded">
        {categoryTabs}
        {emojiGrid}
      </div>
    );
  }

  return (
    <div className="emoji-picker" role="dialog" aria-label="Эмодзи">
      <div className="emoji-picker__header">
        <span className="emoji-picker__title">Эмодзи</span>
        <button
          type="button"
          className="emoji-picker__close"
          onClick={onClose}
          aria-label="Закрыть"
        >
          <Close fontSize="small" />
        </button>
      </div>

      {emojiGrid}
      {categoryTabs}
    </div>
  );
};

export default EmojiPicker;
