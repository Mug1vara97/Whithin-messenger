import { useCallback, useEffect, useRef } from 'react';
import { useAuthContext } from '../contexts/AuthContext';
import { useCallStore } from '../stores/callStore';
import {
  buildActiveCallOverlayView,
  dismissDesktopActiveCallOverlay,
  isElectronActiveCallOverlayAvailable,
  shouldShowDesktopActiveCallOverlay,
  showDesktopActiveCallOverlay,
  syncDesktopActiveCallOverlaySettings,
  syncDesktopActiveCallOverlayTheme,
  updateDesktopActiveCallOverlay,
} from '../utils/desktopActiveCallOverlayBridge';

export function DesktopActiveCallOverlaySync() {
  const { isAuthenticated, user } = useAuthContext();
  const overlayVisibleRef = useRef(false);
  const userRef = useRef(user);
  const visibilityRef = useRef({
    minimized: false,
    visible: true,
    focused: typeof document !== 'undefined' ? document.hasFocus() : true,
  });

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const syncOverlay = useCallback(() => {
    if (!isElectronActiveCallOverlayAvailable()) return;

    const state = useCallStore.getState();
    const view = buildActiveCallOverlayView(state, userRef.current);
    const shouldShow = shouldShowDesktopActiveCallOverlay(state, visibilityRef.current);

    if (shouldShow && view) {
      if (!overlayVisibleRef.current) {
        syncDesktopActiveCallOverlaySettings();
        syncDesktopActiveCallOverlayTheme();
        showDesktopActiveCallOverlay(view);
        overlayVisibleRef.current = true;
        return;
      }

      updateDesktopActiveCallOverlay(view);
      return;
    }

    dismissDesktopActiveCallOverlay();
    overlayVisibleRef.current = false;
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !isElectronActiveCallOverlayAvailable()) return undefined;

    syncDesktopActiveCallOverlaySettings();
    syncDesktopActiveCallOverlayTheme();

    const onThemeChanged = () => {
      syncDesktopActiveCallOverlayTheme();
      syncOverlay();
    };

    window.addEventListener('themePresetChanged', onThemeChanged);
    return () => window.removeEventListener('themePresetChanged', onThemeChanged);
  }, [isAuthenticated, syncOverlay]);

  useEffect(() => {
    if (!isAuthenticated || !isElectronActiveCallOverlayAvailable()) return undefined;

    const onFocus = () => {
      visibilityRef.current = { ...visibilityRef.current, focused: true };
      syncOverlay();
    };

    const onBlur = () => {
      visibilityRef.current = { ...visibilityRef.current, focused: false };
      syncOverlay();
    };

    const onSettingsChanged = () => {
      syncDesktopActiveCallOverlaySettings();
      syncOverlay();
    };

    const onVoiceCallStateChanged = () => {
      syncOverlay();
    };

    const unsubscribeVisibility = window.electronAPI.onWindowVisibilityChanged?.((state) => {
      visibilityRef.current = {
        ...visibilityRef.current,
        ...(state || {}),
      };
      syncOverlay();
    });

    window.addEventListener('focus', onFocus);
    window.addEventListener('blur', onBlur);
    window.addEventListener('activeCallOverlaySettingsChanged', onSettingsChanged);
    window.addEventListener('notificationSettingsChanged', onSettingsChanged);
    window.addEventListener('voiceCallOverlaySync', onVoiceCallStateChanged);
    window.addEventListener('voiceCallEnded', onVoiceCallStateChanged);

    const unsubscribeForceSync = window.electronAPI.onForceActiveCallOverlaySync?.(() => {
      syncOverlay();
    });

    return () => {
      unsubscribeVisibility?.();
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('activeCallOverlaySettingsChanged', onSettingsChanged);
      window.removeEventListener('notificationSettingsChanged', onSettingsChanged);
      window.removeEventListener('voiceCallOverlaySync', onVoiceCallStateChanged);
      window.removeEventListener('voiceCallEnded', onVoiceCallStateChanged);
      unsubscribeForceSync?.();
    };
  }, [isAuthenticated, syncOverlay]);

  useEffect(() => {
    if (!isAuthenticated || !isElectronActiveCallOverlayAvailable()) return undefined;

    syncOverlay();

    const unsubscribe = useCallStore.subscribe(syncOverlay);
    // Пока оверлей виден — только события; интервал нужен лишь для появления оверлея.
    const intervalId = window.setInterval(() => {
      const inCall = useCallStore.getState().isInCall;
      if (!inCall && !overlayVisibleRef.current) {
        return;
      }
      syncOverlay();
    }, 100);

    return () => {
      unsubscribe();
      window.clearInterval(intervalId);
    };
  }, [isAuthenticated, syncOverlay]);

  useEffect(() => {
    if (!isAuthenticated) return undefined;

    return () => {
      dismissDesktopActiveCallOverlay();
      overlayVisibleRef.current = false;
    };
  }, [isAuthenticated]);

  return null;
}
