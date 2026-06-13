import { useEffect } from 'react';

const BASE_TITLE = 'Whithin';

const normalizeBadgeCount = (value) => {
  const count = Number(value);
  if (!Number.isFinite(count) || count <= 0) return 0;
  return Math.min(Math.floor(count), 9999);
};

const formatTitleCount = (count) => (count > 99 ? '99+' : String(count));

export function useAppBadge(unreadCount) {
  useEffect(() => {
    const count = normalizeBadgeCount(unreadCount);
    const titleSuffix = count > 0 ? `(${formatTitleCount(count)}) ` : '';

    document.title = `${titleSuffix}${BASE_TITLE}`;

    window.electronAPI?.setBadgeCount?.(count);

    if (typeof navigator !== 'undefined' && 'setAppBadge' in navigator) {
      if (count > 0) {
        const badgeValue = count > 99 ? 99 : count;
        navigator.setAppBadge(badgeValue).catch(() => {});
      } else if (typeof navigator.clearAppBadge === 'function') {
        navigator.clearAppBadge().catch(() => {});
      }
    }
  }, [unreadCount]);

  useEffect(() => () => {
    document.title = BASE_TITLE;
    window.electronAPI?.setBadgeCount?.(0);
    navigator.clearAppBadge?.().catch(() => {});
  }, []);
}
