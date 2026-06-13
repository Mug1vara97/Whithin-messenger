import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { notificationApi } from '../api';
import { normalizeNotification } from '../lib/notificationDisplay';
import { useConnectionContext } from '../../../shared/lib/contexts/ConnectionContext';
import { useAuth } from '../../../shared/lib/hooks/useAuth';
import { dispatchNotificationReceived } from '../../../shared/lib/utils/notificationRealtimeBridge';
import {
  dismissDesktopNotificationById,
  dismissDesktopNotificationsByChatId,
} from '../../../shared/lib/utils/desktopNotificationBridge';
import {
  getInAppNotificationsEnabled,
  getNotificationSoundVolumeFactor,
  getSoundNotificationsEnabled,
} from '../../../shared/lib/utils/inAppNotificationSettings';
import { getAppSoundUrl } from '../../../shared/lib/utils/appSoundSettings';

export const useNotifications = () => {
  const { user } = useAuth();
  const connectionContext = useConnectionContext();
  const notificationSoundRef = useRef(null);
  const lastSoundPlayedAtRef = useRef(0);
  const soundNotificationsEnabledRef = useRef(true);
  const notificationSoundVolumeRef = useRef(1);
  const [soundNotificationsEnabled, setSoundNotificationsEnabled] = useState(() => getSoundNotificationsEnabled());

  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const sortByDate = useCallback(
    (items) =>
      [...items].sort(
        (a, b) =>
          new Date(b.createdAt || b.CreatedAt || 0).getTime() -
          new Date(a.createdAt || a.CreatedAt || 0).getTime()
      ),
    []
  );

  const refreshNotifications = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await notificationApi.getNotifications({
        page: 1,
        pageSize: 50,
        unreadOnly: true,
      });
      setNotifications(sortByDate(data));
    } catch (err) {
      setError(err?.message || 'Не удалось загрузить уведомления');
    } finally {
      setLoading(false);
    }
  }, [sortByDate]);

  const refreshUnreadCount = useCallback(async () => {
    try {
      const count = await notificationApi.getUnreadCount();
      setUnreadCount(count);
    } catch (err) {
      console.error('Failed to load unread notification count', err);
    }
  }, []);

  const markAsRead = useCallback(
    async (notificationId) => {
      try {
        await notificationApi.markAsRead(notificationId);
        setNotifications((prev) =>
          prev.filter((item) => (item.id || item.Id) !== notificationId)
        );
        dismissDesktopNotificationById(notificationId);
        window.dispatchEvent(
          new CustomEvent('notificationRead', { detail: { notificationId } }),
        );
        await refreshUnreadCount();
      } catch (err) {
        setError(err?.message || 'Не удалось отметить уведомление как прочитанное');
      }
    },
    [refreshUnreadCount]
  );

  const markChatAsRead = useCallback(
    async (chatId) => {
      try {
        await notificationApi.markChatAsRead(chatId);
        setNotifications((prev) =>
          prev.filter((item) => (item.chatId || item.ChatId) !== chatId)
        );
        dismissDesktopNotificationsByChatId(chatId);
        window.dispatchEvent(
          new CustomEvent('notificationRead', { detail: { chatId } }),
        );
        await refreshUnreadCount();
      } catch (err) {
        setError(err?.message || 'Не удалось отметить уведомления чата как прочитанные');
      }
    },
    [refreshUnreadCount]
  );

  const deleteNotification = useCallback(
    async (notificationId) => {
      try {
        await notificationApi.deleteNotification(notificationId);
        setNotifications((prev) =>
          prev.filter((item) => (item.id || item.Id) !== notificationId)
        );
        await refreshUnreadCount();
      } catch (err) {
        setError(err?.message || 'Не удалось удалить уведомление');
      }
    },
    [refreshUnreadCount]
  );

  const playNotificationSound = useCallback(() => {
    if (!getInAppNotificationsEnabled()) return;

    const now = Date.now();
    if (now - lastSoundPlayedAtRef.current < 300) return;
    lastSoundPlayedAtRef.current = now;

    const audio = notificationSoundRef.current;
    if (!audio) return;

    const volume = notificationSoundVolumeRef.current;
    if (volume <= 0) return;

    try {
      audio.volume = volume;
      audio.currentTime = 0;
      const playPromise = audio.play();
      if (playPromise?.catch) {
        playPromise.catch(() => {
          // Browser autoplay restrictions can block sound until user interaction.
        });
      }
    } catch {
      // Ignore sound playback errors to keep notifications functional.
    }
  }, []);

  useEffect(() => {
    refreshNotifications();
    refreshUnreadCount();
  }, [refreshNotifications, refreshUnreadCount]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (notificationSoundRef.current) return;

    notificationSoundRef.current = new Audio(getAppSoundUrl('messageNotification') || '/notification-sound.mp3');
    notificationSoundRef.current.preload = 'auto';
  }, []);

  const applyNotificationSoundSource = useCallback(() => {
    const audio = notificationSoundRef.current;
    if (!audio) return;
    audio.src = getAppSoundUrl('messageNotification') || '/notification-sound.mp3';
    audio.load();
  }, []);

  useEffect(() => {
    soundNotificationsEnabledRef.current = soundNotificationsEnabled;
  }, [soundNotificationsEnabled]);

  useEffect(() => {
    notificationSoundVolumeRef.current = getNotificationSoundVolumeFactor();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const syncSetting = () => {
      soundNotificationsEnabledRef.current = getSoundNotificationsEnabled();
      notificationSoundVolumeRef.current = getNotificationSoundVolumeFactor();
      setSoundNotificationsEnabled(soundNotificationsEnabledRef.current);
      applyNotificationSoundSource();
    };

    const onStorage = (event) => {
      if (
        event.key === 'soundNotificationsEnabled'
        || event.key === 'notificationSoundVolume'
        || event.key === 'inAppNotificationsEnabled'
        || event.key === 'appCustomSounds'
      ) {
        syncSetting();
      }
    };

    window.addEventListener('storage', onStorage);
    window.addEventListener('notificationSettingsChanged', syncSetting);
    window.addEventListener('appSoundSettingsChanged', syncSetting);

    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('notificationSettingsChanged', syncSetting);
      window.removeEventListener('appSoundSettingsChanged', syncSetting);
    };
  }, [applyNotificationSoundSource]);

  useEffect(() => {
    if (!user?.id || !connectionContext?.getConnection) return undefined;

    let mounted = true;
    let connection = null;

    const onReceiveNotification = (payload) => {
      const normalized = normalizeNotification(payload);
      const notificationId = normalized.id;
      if (!notificationId) return;

      let isNewNotification = false;
      setNotifications((prev) => {
        if (prev.some((item) => (item.id || item.Id) === notificationId)) {
          return prev;
        }
        isNewNotification = true;
        return sortByDate([normalized, ...prev]);
      });

      if (!isNewNotification) return;

      if (
        getInAppNotificationsEnabled()
        && soundNotificationsEnabledRef.current
        && notificationSoundVolumeRef.current > 0
        && !(normalized.isRead ?? false)
      ) {
        playNotificationSound();
      }

      dispatchNotificationReceived(normalized);
    };

    const onUnreadCountChanged = (count) => {
      setUnreadCount(typeof count === 'number' ? count : 0);
    };

    const setupRealtime = async () => {
      try {
        connection = await connectionContext.getConnection('notificationhub', user.id);
        if (!mounted || !connection) return;

        connection.off('ReceiveNotification', onReceiveNotification);
        connection.on('ReceiveNotification', onReceiveNotification);
        connection.off('UnreadCountChanged', onUnreadCountChanged);
        connection.on('UnreadCountChanged', onUnreadCountChanged);
      } catch (err) {
        console.error('Failed to setup notification realtime', err);
      }
    };

    setupRealtime();

    return () => {
      mounted = false;
      if (connection) {
        connection.off('ReceiveNotification', onReceiveNotification);
        connection.off('UnreadCountChanged', onUnreadCountChanged);
      }
    };
  }, [user?.id, connectionContext, sortByDate, playNotificationSound]);

  const hasUnread = useMemo(() => unreadCount > 0, [unreadCount]);
  const unreadCountByChat = useMemo(() => {
    return notifications.reduce((acc, item) => {
      const chatId = item.chatId || item.ChatId;
      if (!chatId) return acc;
      acc[chatId] = (acc[chatId] || 0) + 1;
      return acc;
    }, {});
  }, [notifications]);

  return {
    notifications,
    unreadCount,
    unreadCountByChat,
    hasUnread,
    loading,
    error,
    refreshNotifications,
    refreshUnreadCount,
    markAsRead,
    markChatAsRead,
    deleteNotification,
  };
};
