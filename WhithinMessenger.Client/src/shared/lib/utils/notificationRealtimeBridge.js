const RECENT_DISPATCH_MS = 3000;
const recentDispatches = new Map();

export function dispatchNotificationReceived(normalized) {
  if (typeof window === 'undefined' || !normalized) return false;

  const notificationId = normalized.id || normalized.Id || normalized.notificationId;
  if (!notificationId) return false;

  const now = Date.now();
  const lastAt = recentDispatches.get(notificationId);
  if (lastAt && now - lastAt < RECENT_DISPATCH_MS) {
    return false;
  }

  recentDispatches.set(notificationId, now);

  if (recentDispatches.size > 200) {
    for (const [id, at] of recentDispatches) {
      if (now - at > RECENT_DISPATCH_MS) {
        recentDispatches.delete(id);
      }
    }
  }

  window.dispatchEvent(
    new CustomEvent('notificationReceived', { detail: normalized }),
  );

  return true;
}
