import { useAuthContext } from '../contexts/AuthContext';
import { useNotificationContext } from '../contexts/NotificationContext';
import { useAppBadge } from './useAppBadge';

export function AppBadgeSync() {
  const { isAuthenticated } = useAuthContext();
  const { unreadCount } = useNotificationContext();

  useAppBadge(isAuthenticated ? unreadCount : 0);

  return null;
}

export default AppBadgeSync;
