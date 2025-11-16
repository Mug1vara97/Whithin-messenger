import React, { createContext, useState, useEffect, useRef, useCallback } from 'react';
import { HubConnectionBuilder } from '@microsoft/signalr';
import { notificationApi } from '../../../entities/notification/api';
import { useAuthContext } from './AuthContext';
import { BASE_URL, HUB_ENDPOINTS } from '../constants/apiEndpoints';
import tokenManager from '../services/tokenManager';

const NotificationContext = createContext(null);

export { NotificationContext };

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  
  const connectionRef = useRef(null);
  const userIdRef = useRef(null);
  const { user, isAuthenticated } = useAuthContext();

  const initializeConnection = useCallback((userId) => {
    if (connectionRef.current) {
      try {
        connectionRef.current.stop();
      } catch (error) {
        console.log('Error stopping existing connection:', error);
      }
      connectionRef.current = null;
    }

    userIdRef.current = userId;
    
    const token = tokenManager.getToken();
    const url = `${BASE_URL}${HUB_ENDPOINTS.NOTIFICATION_HUB}`;
    const connectionUrl = token ? `${url}?access_token=${token}` : url;
    
    const connection = new HubConnectionBuilder()
      .withUrl(connectionUrl)
      .withAutomaticReconnect([0, 2000, 10000, 30000])
      .build();

    connection.on('ReceiveNotification', (notification) => {
      console.log('Received notification:', notification);
      
      setNotifications(prev => {
        const existingNotification = prev.find(n => 
          n.id === notification.notificationId ||
          (n.chatId === notification.chatId && n.messageId === notification.messageId)
        );
        
        if (existingNotification) {
          return prev;
        }
        
        if (!notification.isRead) {
          const newNotification = {
            id: notification.notificationId || notification.id,
            userId: userId,
            chatId: notification.chatId,
            messageId: notification.messageId,
            type: notification.type,
            content: notification.content,
            isRead: notification.isRead,
            createdAt: notification.createdAt
          };
          
          setUnreadCount(prevCount => prevCount + 1);
          
          try {
            const audio = new Audio('/notification-sound.mp3');
            audio.volume = 0.5;
            audio.play().catch(() => console.log('Notification sound not available'));
          } catch (error) {
            console.log('Error playing notification sound:', error);
          }
          
          if (Notification.permission === 'granted') {
            new Notification('Новое сообщение', {
              body: notification.content,
              icon: '/vite.svg'
            });
          }
          
          return [newNotification, ...prev];
        }
        
        return prev;
      });
    });

    connection.on('UnreadCountChanged', (count) => {
      console.log('Unread count changed:', count);
      setUnreadCount(count);
    });

    connection.on('MessageRead', (chatId, messageId) => {
      console.log('Message read:', chatId, messageId);
      setNotifications(prev => prev.filter(n => !(n.chatId === chatId && n.messageId === messageId)));
      setUnreadCount(prev => Math.max(0, prev - 1));
    });

    connection.onreconnecting((error) => console.log('NotificationHub reconnecting:', error));
    connection.onreconnected((connectionId) => console.log('NotificationHub reconnected:', connectionId));
    connection.onclose((error) => console.log('NotificationHub connection closed:', error));

    const startConnection = async () => {
      try {
        await connection.start();
        console.log('Connected to NotificationHub');
        connectionRef.current = connection;
      } catch (err) {
        console.error('Error connecting to NotificationHub:', err);
        setTimeout(() => {
          if (userIdRef.current === userId) {
            startConnection();
          }
        }, 5000);
      }
    };

    startConnection();
  }, []);

  const loadNotifications = useCallback(async (page = 1, append = false, unreadOnly = true) => {
    if (!user?.id) return;
    
    setIsLoading(true);
    try {
      const data = await notificationApi.getNotifications(page, 20, unreadOnly);
      
      const mappedData = data.map(n => ({
        id: n.id,
        userId: n.userId,
        chatId: n.chatId,
        messageId: n.messageId,
        type: n.type,
        content: n.content,
        isRead: n.isRead,
        createdAt: n.createdAt,
        readAt: n.readAt
      }));
      
      setNotifications(prev => append ? [...prev, ...mappedData] : mappedData);
      setCurrentPage(page);
      setHasMore(data.length === 20);
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  const loadUnreadCount = useCallback(async () => {
    if (!user?.id) return;
    try {
      const count = await notificationApi.getUnreadCount();
      setUnreadCount(count);
    } catch (error) {
      console.error('Error loading unread count:', error);
    }
  }, [user?.id]);

  const markAsRead = useCallback(async (notificationId) => {
    if (!user?.id) return;
    try {
      await notificationApi.markAsRead(notificationId);
      setNotifications(prev => {
        const notification = prev.find(n => n.id === notificationId);
        const filtered = prev.filter(n => n.id !== notificationId);
        
        if (notification && !notification.isRead) {
          setUnreadCount(prevCount => Math.max(0, prevCount - 1));
        }
        
        return filtered;
      });
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  }, [user?.id]);

  const markChatAsRead = useCallback(async (chatId) => {
    if (!user?.id) return;
    try {
      await notificationApi.markChatAsRead(chatId);
      setNotifications(prev => {
        const filtered = prev.filter(n => n.chatId !== chatId);
        const removedCount = prev.length - filtered.length;
        setUnreadCount(prevCount => Math.max(0, prevCount - removedCount));
        return filtered;
      });
    } catch (error) {
      console.error('Error marking chat notifications as read:', error);
    }
  }, [user?.id]);

  const deleteNotification = useCallback(async (notificationId) => {
    if (!user?.id) return;
    try {
      await notificationApi.deleteNotification(notificationId);
      setNotifications(prev => {
        const notification = prev.find(n => n.id === notificationId);
        const filtered = prev.filter(n => n.id !== notificationId);
        
        if (notification && !notification.isRead) {
          setUnreadCount(prevCount => Math.max(0, prevCount - 1));
        }
        
        return filtered;
      });
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  }, [user?.id]);

  const initializeForUser = useCallback(async (userId) => {
    if (!userId || (userIdRef.current === userId && connectionRef.current)) {
      return;
    }
    
    console.log('Initializing notifications for user:', userId);
    try {
      initializeConnection(userId);
      await loadNotifications(1, false);
      await loadUnreadCount();
    } catch (error) {
      console.error('Error initializing notifications:', error);
    }
  }, [initializeConnection, loadNotifications, loadUnreadCount]);

  const loadMore = useCallback(async () => {
    if (!user?.id || isLoading || !hasMore) return;
    await loadNotifications(currentPage + 1, true);
  }, [user?.id, isLoading, hasMore, currentPage, loadNotifications]);

  const requestNotificationPermission = useCallback(async () => {
    if (Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      console.log('Notification permission:', permission);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated && user?.id) {
      requestNotificationPermission();
      initializeForUser(user.id);
    } else if (!isAuthenticated && connectionRef.current) {
      try {
        connectionRef.current.stop();
        connectionRef.current = null;
        userIdRef.current = null;
        setNotifications([]);
        setUnreadCount(0);
      } catch (error) {
        console.log('Error stopping connection:', error);
      }
    }
  }, [isAuthenticated, user?.id, initializeForUser, requestNotificationPermission]);

  useEffect(() => {
    return () => {
      if (connectionRef.current) {
        try {
          connectionRef.current.off('ReceiveNotification');
          connectionRef.current.off('UnreadCountChanged');
          connectionRef.current.off('MessageRead');
          connectionRef.current.stop();
        } catch (error) {
          console.log('Error cleaning up connection:', error);
        }
        connectionRef.current = null;
      }
    };
  }, []);

  const value = {
    notifications,
    unreadCount,
    isLoading,
    hasMore,
    initializeForUser,
    loadMore,
    markAsRead,
    markChatAsRead,
    deleteNotification,
    requestNotificationPermission
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

