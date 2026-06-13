import { useCallback, useEffect, useRef } from 'react';
import { useAuthContext } from '../contexts/AuthContext';
import { useConnectionContext } from '../contexts/ConnectionContext';
import { BASE_URL } from '../constants/apiEndpoints';
import {
  buildCallOverlayView,
  dismissDesktopCallOverlay,
  isElectronDesktop,
  shouldShowDesktopCallOverlay,
  showDesktopCallOverlay,
  syncDesktopCallOverlayTheme,
} from '../utils/desktopCallOverlayBridge';

function setDesktopOverlayActive(active) {
  window.dispatchEvent(
    new CustomEvent('desktopCallOverlayActive', { detail: { active: Boolean(active) } }),
  );
}

function dispatchIncomingCallChanged(call) {
  window.dispatchEvent(new CustomEvent('incomingCallChanged', { detail: call }));
}

export function DesktopCallOverlaySync() {
  const { isAuthenticated, user } = useAuthContext();
  const { getConnection } = useConnectionContext();
  const incomingCallRef = useRef(null);
  const overlayActiveRef = useRef(false);
  const callerProfilesRef = useRef(new Map());
  const visibilityRef = useRef({
    minimized: false,
    visible: true,
    focused: typeof document !== 'undefined' ? document.hasFocus() : true,
  });

  const syncOverlay = useCallback(() => {
    if (!isElectronDesktop()) return;

    const incomingCall = incomingCallRef.current;
    const shouldShow = shouldShowDesktopCallOverlay(incomingCall, visibilityRef.current);

    if (shouldShow && incomingCall) {
      showDesktopCallOverlay(incomingCall);
      if (!overlayActiveRef.current) {
        overlayActiveRef.current = true;
        setDesktopOverlayActive(true);
      }
      return;
    }

    dismissDesktopCallOverlay();
    if (overlayActiveRef.current) {
      overlayActiveRef.current = false;
      setDesktopOverlayActive(false);
    }
  }, []);

  const applyIncomingCall = useCallback((call) => {
    incomingCallRef.current = call;
    dispatchIncomingCallChanged(call);
    syncOverlay();
  }, [syncOverlay]);

  useEffect(() => {
    if (!isAuthenticated || !isElectronDesktop()) return undefined;

    syncDesktopCallOverlayTheme();

    const onThemeChanged = () => {
      syncDesktopCallOverlayTheme();
    };

    window.addEventListener('themePresetChanged', onThemeChanged);
    return () => window.removeEventListener('themePresetChanged', onThemeChanged);
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || !isElectronDesktop()) return undefined;

    const onFocus = () => {
      visibilityRef.current = { ...visibilityRef.current, focused: true };
      syncOverlay();
    };

    const onBlur = () => {
      visibilityRef.current = { ...visibilityRef.current, focused: false };
      syncOverlay();
    };

    const unsubscribe = window.electronAPI.onWindowVisibilityChanged?.((state) => {
      visibilityRef.current = {
        ...visibilityRef.current,
        ...(state || {}),
      };
      syncOverlay();
    });

    window.addEventListener('focus', onFocus);
    window.addEventListener('blur', onBlur);

    return () => {
      unsubscribe?.();
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('blur', onBlur);
    };
  }, [isAuthenticated, syncOverlay]);

  useEffect(() => {
    if (!isAuthenticated || !user?.id || !getConnection) return undefined;

    let mounted = true;
    let connection = null;
    let incomingCallHandler = null;

    const setupIncomingCallListener = async () => {
      try {
        connection = await getConnection('groupchathub', user.id);
        if (!mounted || !connection) return;

        incomingCallHandler = (payload) => {
          const chatIdValue = payload?.chatId || payload?.ChatId;
          const callerId = payload?.callerId || payload?.CallerId;
          const callerName = payload?.caller || payload?.Caller;

          if (!chatIdValue) return;
          if (String(callerId) === String(user.id)) return;

          const callerKey = callerId ? String(callerId) : '';
          const cachedCallerProfile = callerKey ? callerProfilesRef.current.get(callerKey) : null;

          const call = {
            chatId: String(chatIdValue),
            callerId: callerKey || null,
            callerName: callerName || 'Неизвестный',
            chatName: callerName || 'Неизвестный',
            avatarUrl: cachedCallerProfile?.avatarUrl || null,
            avatarColor: cachedCallerProfile?.avatarColor || '#5865F2',
          };

          applyIncomingCall(call);

          if (callerKey && !cachedCallerProfile) {
            fetch(`${BASE_URL}/api/profile/${callerKey}/profile`)
              .then(async (response) => {
                if (!response.ok) return null;
                const profile = await response.json();
                return {
                  avatarUrl: profile?.avatar || null,
                  avatarColor: profile?.avatarColor || '#5865F2',
                };
              })
              .then((profileData) => {
                if (!profileData || !mounted) return;
                callerProfilesRef.current.set(callerKey, profileData);
                if (incomingCallRef.current?.callerId !== callerKey) return;
                applyIncomingCall({
                  ...incomingCallRef.current,
                  avatarUrl: profileData.avatarUrl || incomingCallRef.current.avatarUrl,
                  avatarColor: profileData.avatarColor || incomingCallRef.current.avatarColor,
                });
              })
              .catch(() => {});
          }
        };

        connection.off('IncomingCall', incomingCallHandler);
        connection.on('IncomingCall', incomingCallHandler);
      } catch (error) {
        console.warn('DesktopCallOverlaySync: failed to setup IncomingCall listener', error);
      }
    };

    setupIncomingCallListener();

    return () => {
      mounted = false;
      if (connection && incomingCallHandler) {
        connection.off('IncomingCall', incomingCallHandler);
      }
    };
  }, [applyIncomingCall, getConnection, isAuthenticated, user?.id]);

  useEffect(() => {
    if (!isAuthenticated || !isElectronDesktop()) return undefined;

    const onIncomingCallChanged = (event) => {
      if (event.detail === incomingCallRef.current) return;
      incomingCallRef.current = event.detail || null;
      syncOverlay();

      if (incomingCallRef.current && overlayActiveRef.current) {
        const view = buildCallOverlayView(incomingCallRef.current);
        if (view) {
          window.electronAPI.updateCallOverlay?.(view);
        }
      }
    };

    window.addEventListener('incomingCallChanged', onIncomingCallChanged);
    return () => window.removeEventListener('incomingCallChanged', onIncomingCallChanged);
  }, [isAuthenticated, syncOverlay]);

  useEffect(() => {
    if (!isAuthenticated || !isElectronDesktop()) return undefined;

    const onCallOverlayAction = (event) => {
      if (event.detail?.action === 'decline' || event.detail?.action === 'accept') {
        incomingCallRef.current = null;
        dispatchIncomingCallChanged(null);
      }

      window.dispatchEvent(
        new CustomEvent('incomingCallOverlayAction', {
          detail: { action: event.detail?.action },
        }),
      );
    };

    const unsubscribe = window.electronAPI.onCallOverlayAction?.(onCallOverlayAction);
    return () => {
      unsubscribe?.();
    };
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return undefined;

    return () => {
      dismissDesktopCallOverlay();
      if (overlayActiveRef.current) {
        overlayActiveRef.current = false;
        setDesktopOverlayActive(false);
      }
    };
  }, [isAuthenticated]);

  return null;
}
