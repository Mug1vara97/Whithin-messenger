import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { notificationApi } from '../api';
import { useConnectionContext } from '../../../shared/lib/contexts/ConnectionContext';
import { useAuth } from '../../../shared/lib/hooks/useAuth';

export const useNotifications = () => {
  const { user } = useAuth();
  const connectionContext = useConnectionContext();
  const connectionRef = useRef(null);
  const notificationSoundRef = useRef(null);
  const lastSoundPlayedAtRef = useRef(0);
  const [soundNotificationsEnabled, setSoundNotificationsEnabled] = useState(() => {
    if (typeof window === 'undefined') return true;
    const saved = localStorage.getItem('soundNotificationsEnabled');
    return saved == null ? true : JSON.parse(saved);
  });

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
    const now = Date.now();
    if (now - lastSoundPlayedAtRef.current < 300) return;
    lastSoundPlayedAtRef.current = now;

    const audio = notificationSoundRef.current;
    if (!audio) return;

    try {
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

    notificationSoundRef.current = new Audio('/notification-sound.mp3');
    notificationSoundRef.current.preload = 'auto';
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const syncSetting = () => {
      const saved = localStorage.getItem('soundNotificationsEnabled');
      setSoundNotificationsEnabled(saved == null ? true : JSON.parse(saved));
    };

    const onStorage = (event) => {
      if (event.key === 'soundNotificationsEnabled') {
        syncSetting();
      }
    };

    window.addEventListener('storage', onStorage);
    window.addEventListener('notificationSettingsChanged', syncSetting);

    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('notificationSettingsChanged', syncSetting);
    };
  }, []);

  useEffect(() => {
    if (!user?.id || !connectionContext?.getConnection) return;
    let mounted = true;

    const setupRealtime = async () => {
      try {
        const connection = await connectionContext.getConnection('notificationhub', user.id);
        if (!mounted) return;
        connectionRef.current = connection;

        const onReceiveNotification = (payload) => {
          const normalized = {
            id: payload.notificationId ?? payload.id,
            chatId: payload.chatId,
            serverId: payload.serverId,
            messageId: payload.messageId,
            type: payload.type,
            content: payload.content,
            isRead: payload.isRead ?? false,
            createdAt: payload.createdAt,
          };
          setNotifications((prev) => sortByDate([normalized, ...prev]));
          setUnreadCount((prev) => prev + 1);
          if (soundNotificationsEnabled && !(normalized.isRead ?? false)) {
            playNotificationSound();
          }
        };

        const onUnreadCountChanged = (count) => {
          setUnreadCount(typeof count === 'number' ? count : 0);
        };

        connection.on('ReceiveNotification', onReceiveNotification);
        connection.on('UnreadCountChanged', onUnreadCountChanged);
      } catch (err) {
        console.error('Failed to setup notification realtime', err);
      }
    };

    setupRealtime();

    return () => {
      mounted = false;
      if (connectionRef.current) {
        connectionRef.current.off('ReceiveNotification');
        connectionRef.current.off('UnreadCountChanged');
      }
    };
  }, [user?.id, connectionContext, sortByDate, playNotificationSound, soundNotificationsEnabled]);

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
