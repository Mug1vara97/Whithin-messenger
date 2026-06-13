import { useCallback, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { notificationApi } from '../../../entities/notification/api';
import { useAuthContext } from '../contexts/AuthContext';
import {
  getSystemNotificationsEnabled,
  setSystemNotificationsEnabled,
} from '../utils/systemNotificationSettings';
import {
  requestSystemNotificationPermission,
  showSystemNotification,
} from '../utils/systemNotificationService';

export function SystemNotificationSync() {
  const { isAuthenticated } = useAuthContext();
  const location = useLocation();
  const navigate = useNavigate();
  const isAppFocusedRef = useRef(document.hasFocus());
  const pathnameRef = useRef(location.pathname);
  const enabledRef = useRef(getSystemNotificationsEnabled());

  useEffect(() => {
    pathnameRef.current = location.pathname;
  }, [location.pathname]);

  useEffect(() => {
    const onFocus = () => {
      isAppFocusedRef.current = true;
    };
    const onBlur = () => {
      isAppFocusedRef.current = false;
    };

    window.addEventListener('focus', onFocus);
    window.addEventListener('blur', onBlur);

    return () => {
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  useEffect(() => {
    const syncSettings = () => {
      enabledRef.current = getSystemNotificationsEnabled();
    };

    window.addEventListener('notificationSettingsChanged', syncSettings);
    return () => window.removeEventListener('notificationSettingsChanged', syncSettings);
  }, []);

  const openNotificationTarget = useCallback(async (notification) => {
    if (!notification?.id) return;

    try {
      await notificationApi.markAsRead(notification.id);
    } catch (error) {
      console.warn('SystemNotificationSync: failed to mark notification as read', error);
    }

    if (!notification.chatId) return;

    if (notification.serverId) {
      navigate(`/server/${notification.serverId}/channel/${notification.chatId}`);
      return;
    }

    navigate(`/channels/@me/${notification.chatId}`);
  }, [navigate]);

  useEffect(() => {
    if (!isAuthenticated) return undefined;

    const onNotificationReceived = (event) => {
      if (!enabledRef.current) return;

      showSystemNotification(event.detail, {
        pathname: pathnameRef.current,
        isAppFocused: isAppFocusedRef.current,
      });
    };

    const onOpenTarget = (event) => {
      openNotificationTarget(event.detail);
    };

    const onRequestPermission = async (event) => {
      const permission = await requestSystemNotificationPermission();
      event.detail?.resolve?.(permission);
      if (permission === 'granted') {
        setSystemNotificationsEnabled(true);
      }
    };

    window.addEventListener('notificationReceived', onNotificationReceived);
    window.addEventListener('openNotificationTarget', onOpenTarget);
    window.addEventListener('requestSystemNotificationPermission', onRequestPermission);

    return () => {
      window.removeEventListener('notificationReceived', onNotificationReceived);
      window.removeEventListener('openNotificationTarget', onOpenTarget);
      window.removeEventListener('requestSystemNotificationPermission', onRequestPermission);
    };
  }, [isAuthenticated, openNotificationTarget]);

  return null;
}
