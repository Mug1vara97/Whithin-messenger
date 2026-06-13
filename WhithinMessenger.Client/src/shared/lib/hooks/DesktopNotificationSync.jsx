import { useCallback, useEffect, useRef, useState } from 'react';

import { useLocation, useNavigate } from 'react-router-dom';

import { notificationApi } from '../../../entities/notification/api';

import { useAuthContext } from '../contexts/AuthContext';

import { InAppNotificationStack } from '../../ui/organisms/InAppNotificationStack';

import {

  getInAppNotificationsEnabled,

  getNotificationPosition,

  NOTIFICATION_AUTO_DISMISS_MS,

} from '../utils/inAppNotificationSettings';

import {

  buildInAppNotificationView,

  shouldShowInAppNotification,

} from '../utils/inAppNotificationService';

import {

  dismissDesktopNotificationById,

  dismissDesktopNotificationsByChatId,

  dismissAllDesktopNotifications,

  getActiveChatIdFromPathname,

  isElectronDesktop,

  syncDesktopNotificationSettings,

  syncDesktopNotificationTheme,

} from '../utils/desktopNotificationBridge';



const MAX_VISIBLE_TOASTS = 5;



export function DesktopNotificationSync() {

  const { isAuthenticated } = useAuthContext();

  const location = useLocation();

  const navigate = useNavigate();

  const isAppFocusedRef = useRef(document.hasFocus());

  const pathnameRef = useRef(location.pathname);

  const enabledRef = useRef(getInAppNotificationsEnabled());

  const toastTimersRef = useRef(new Map());

  const [browserToasts, setBrowserToasts] = useState([]);

  const [notificationPosition, setNotificationPosition] = useState(() => getNotificationPosition());



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



  const clearToastTimer = useCallback((notificationId) => {

    const timer = toastTimersRef.current.get(notificationId);

    if (!timer) return;

    clearTimeout(timer);

    toastTimersRef.current.delete(notificationId);

  }, []);



  const dismissBrowserToast = useCallback((notificationId) => {

    clearToastTimer(notificationId);

    setBrowserToasts((prev) => prev.filter((item) => item.id !== notificationId));

  }, [clearToastTimer]);



  const scheduleBrowserToastExpiry = useCallback((notificationId) => {

    clearToastTimer(notificationId);

    const timer = setTimeout(() => {

      dismissBrowserToast(notificationId);

    }, NOTIFICATION_AUTO_DISMISS_MS);

    toastTimersRef.current.set(notificationId, timer);

  }, [clearToastTimer, dismissBrowserToast]);



  const dismissBrowserToastsByChatId = useCallback((chatId) => {

    if (!chatId) return;

    const chatIdStr = String(chatId);

    setBrowserToasts((prev) => {

      prev

        .filter((item) => String(item.chatId) === chatIdStr)

        .forEach((item) => clearToastTimer(item.id));

      return prev.filter((item) => String(item.chatId) !== chatIdStr);

    });

  }, [clearToastTimer]);



  useEffect(() => {

    const syncSettings = (event) => {

      enabledRef.current = getInAppNotificationsEnabled();

      if (!enabledRef.current) {
        dismissAllDesktopNotifications();
        toastTimersRef.current.forEach((timer) => clearTimeout(timer));
        toastTimersRef.current.clear();
        setBrowserToasts([]);
      }

      if (event?.detail?.position) {

        setNotificationPosition(event.detail.position);

      } else {

        setNotificationPosition(getNotificationPosition());

      }

      syncDesktopNotificationSettings();

    };



    window.addEventListener('notificationSettingsChanged', syncSettings);

    return () => window.removeEventListener('notificationSettingsChanged', syncSettings);

  }, []);



  useEffect(() => {

    if (!isAuthenticated || !isElectronDesktop()) return undefined;



    syncDesktopNotificationSettings();

    syncDesktopNotificationTheme();



    const onThemeChanged = () => {

      syncDesktopNotificationTheme();

    };



    window.addEventListener('themePresetChanged', onThemeChanged);

    return () => window.removeEventListener('themePresetChanged', onThemeChanged);

  }, [isAuthenticated]);



  useEffect(() => {

    if (!isAuthenticated) return undefined;



    const activeChatId = getActiveChatIdFromPathname(location.pathname);

    if (!activeChatId) return undefined;



    dismissDesktopNotificationsByChatId(activeChatId);

    dismissBrowserToastsByChatId(activeChatId);

  }, [dismissBrowserToastsByChatId, isAuthenticated, location.pathname]);



  useEffect(() => {

    if (!isAuthenticated) return undefined;



    const onNotificationRead = (event) => {

      const { notificationId, chatId } = event.detail || {};

      if (notificationId) {

        dismissDesktopNotificationById(notificationId);

        dismissBrowserToast(notificationId);

      }

      if (chatId) {

        dismissDesktopNotificationsByChatId(chatId);

        dismissBrowserToastsByChatId(chatId);

      }

    };



    window.addEventListener('notificationRead', onNotificationRead);

    return () => window.removeEventListener('notificationRead', onNotificationRead);

  }, [

    dismissBrowserToast,

    dismissBrowserToastsByChatId,

    isAuthenticated,

  ]);



  useEffect(() => () => {

    toastTimersRef.current.forEach((timer) => clearTimeout(timer));

    toastTimersRef.current.clear();

  }, []);



  const openNotificationTarget = useCallback(async (notification) => {

    if (!notification?.id) return;



    try {

      await notificationApi.markAsRead(notification.id);

    } catch (error) {

      console.warn('DesktopNotificationSync: failed to mark notification as read', error);

    }



    dismissDesktopNotificationById(notification.id);

    dismissBrowserToast(notification.id);



    if (!notification.chatId) return;



    if (notification.serverId) {

      navigate(`/server/${notification.serverId}/channel/${notification.chatId}`);

      return;

    }



    navigate(`/channels/@me/${notification.chatId}`);

  }, [dismissBrowserToast, navigate]);



  useEffect(() => {

    if (!isAuthenticated || !isElectronDesktop()) return undefined;



    const unsubscribe = window.electronAPI.onOpenNotification?.((payload) => {

      const item = payload?.raw || payload;

      openNotificationTarget(item);

    });



    return () => {

      unsubscribe?.();

    };

  }, [isAuthenticated, openNotificationTarget]);



  const dismissAllBrowserToasts = useCallback(() => {

    toastTimersRef.current.forEach((timer) => clearTimeout(timer));

    toastTimersRef.current.clear();

    setBrowserToasts([]);

  }, []);



  const openBrowserToast = useCallback(async (toast) => {

    const notification = toast?.raw || toast;

    dismissBrowserToast(notification.id);

    await openNotificationTarget(notification);

  }, [dismissBrowserToast, openNotificationTarget]);



  useEffect(() => {

    if (!isAuthenticated) return undefined;



    const onNotificationReceived = (event) => {

      if (!enabledRef.current) return;



      const shouldShow = shouldShowInAppNotification(event.detail, {

        pathname: pathnameRef.current,

        isAppFocused: isAppFocusedRef.current,

      });



      if (!shouldShow) return;



      const view = buildInAppNotificationView(event.detail);

      const notificationId = view?.id;

      if (!notificationId) return;



      if (isElectronDesktop()) {

        syncDesktopNotificationTheme();

        window.electronAPI.showDesktopNotification(view);

        return;

      }



      setBrowserToasts((prev) => {

        const next = [

          view,

          ...prev.filter((item) => item.id !== view.id),

        ].slice(0, MAX_VISIBLE_TOASTS);



        const dropped = prev.filter((item) => !next.some((entry) => entry.id === item.id));

        dropped.forEach((item) => clearToastTimer(item.id));



        return next;

      });

      scheduleBrowserToastExpiry(notificationId);

    };



    window.addEventListener('notificationReceived', onNotificationReceived);



    return () => {

      window.removeEventListener('notificationReceived', onNotificationReceived);

    };

  }, [clearToastTimer, isAuthenticated, scheduleBrowserToastExpiry]);



  if (!isAuthenticated || isElectronDesktop()) {

    return null;

  }



  return (

    <InAppNotificationStack

      items={browserToasts}

      position={notificationPosition}

      onDismiss={dismissBrowserToast}

      onDismissAll={dismissAllBrowserToasts}

      onOpen={openBrowserToast}

    />

  );

}



export const InAppNotificationSync = DesktopNotificationSync;


