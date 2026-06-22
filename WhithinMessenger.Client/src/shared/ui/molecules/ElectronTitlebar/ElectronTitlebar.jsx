import React, { useCallback, useEffect, useState } from 'react';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import { resolveElectronWindowBackgroundColor } from '../../../lib/theme/appBackgroundSettings';
import { useAuthContext } from '../../../lib/contexts/AuthContext';
import { useNotificationContext } from '../../../lib/contexts/NotificationContext';
import { NotificationBellButton } from '../../atoms/NotificationBellButton';
import {
  NOTIFICATIONS_PANEL_STATE_EVENT,
  toggleNotificationsPanel,
} from '../../../lib/utils/notificationPanelEvents';
import './ElectronTitlebar.css';

const APP_DISPLAY_NAME = 'Whithin';

const TRAFFIC = {
  max: '#28c840',
  min: '#ffbd2e',
  close: '#ff5f57',
};

const iconMax = (
  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
    <rect x="1.75" y="1.75" width="8.5" height="8.5" rx="1" fill="none" stroke={TRAFFIC.max} strokeWidth="1.35" />
  </svg>
);

const iconMin = (
  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
    <path stroke={TRAFFIC.min} strokeWidth="1.35" strokeLinecap="round" d="M2.25 9h7.5" />
  </svg>
);

const iconClose = (
  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
    <path stroke={TRAFFIC.close} strokeWidth="1.35" strokeLinecap="round" d="M3 3l6 6M9 3L3 9" />
  </svg>
);

function hasElectronWindowControls() {
  return Boolean(
    window.electronAPI?.isElectron
    && typeof window.electronAPI.windowClose === 'function'
    && (window.electronAPI.titleBarInsetPx ?? 0) > 0
  );
}

export function hasElectronTitlebarChrome() {
  return hasElectronWindowControls();
}

function ElectronTitlebarNotifications() {
  const { user } = useAuthContext();
  const { unreadCount } = useNotificationContext();
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  useEffect(() => {
    const onPanelState = (event) => {
      setIsPanelOpen(Boolean(event.detail?.isOpen));
    };
    window.addEventListener(NOTIFICATIONS_PANEL_STATE_EVENT, onPanelState);
    return () => window.removeEventListener(NOTIFICATIONS_PANEL_STATE_EVENT, onPanelState);
  }, []);

  const handleNotificationsClick = useCallback(() => {
    toggleNotificationsPanel();
  }, []);

  if (!user) return null;

  return (
    <NotificationBellButton
      unreadCount={unreadCount}
      isOpen={isPanelOpen}
      onClick={handleNotificationsClick}
      variant="titlebar"
      iconSize={18}
    />
  );
}

export function ElectronTitlebar({ showNotifications = true }) {
  const showChrome = hasElectronWindowControls();

  useEffect(() => {
    if (!showChrome) return undefined;
    document.body.classList.add('electron-titlebar-chrome');

    const syncWindowBackground = () => {
      const isFrostedGlass = document.documentElement.getAttribute('data-frosted-glass') === 'enabled';
      window.electronAPI?.syncWindowBackground?.(
        resolveElectronWindowBackgroundColor(isFrostedGlass),
      );
    };

    syncWindowBackground();
    window.electronAPI?.syncWindowShape?.({
      frostedGlass: document.documentElement.getAttribute('data-frosted-glass') === 'enabled',
    });
    window.addEventListener('themePresetChanged', syncWindowBackground);
    window.addEventListener('appBackgroundVisualChanged', syncWindowBackground);
    const observer = new MutationObserver(syncWindowBackground);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme-preset', 'data-frosted-glass', 'data-interface-design', 'style'],
    });

    return () => {
      document.body.classList.remove('electron-titlebar-chrome');
      window.removeEventListener('themePresetChanged', syncWindowBackground);
      window.removeEventListener('appBackgroundVisualChanged', syncWindowBackground);
      observer.disconnect();
    };
  }, [showChrome]);

  const handleReload = useCallback(() => {
    try {
      window.location.reload();
    } catch {
      window.electronAPI?.navigationReload?.();
    }
  }, []);

  if (!showChrome) {
    return null;
  }

  return (
    <>
      <div id="electron-titlebar-fill" aria-hidden="true" />
      <div id="electron-titlebar-drag-shim">
        <span className="electron-titlebar-app-name">{APP_DISPLAY_NAME}</span>
      </div>
      <div id="electron-window-controls">
        {showNotifications && <ElectronTitlebarNotifications />}
        <button
          type="button"
          className="electron-tl electron-nav electron-reload-pill"
          title="Перезагрузить"
          aria-label="Перезагрузить"
          onClick={handleReload}
        >
          <RestartAltIcon className="electron-reload-icon" sx={{ fontSize: 16 }} />
        </button>
        <button
          type="button"
          className="electron-tl electron-tl-max"
          title="Развернуть"
          aria-label="Развернуть"
          onClick={() => window.electronAPI.windowToggleMaximize()}
        >
          {iconMax}
        </button>
        <button
          type="button"
          className="electron-tl electron-tl-min"
          title="Свернуть"
          aria-label="Свернуть"
          onClick={() => window.electronAPI.windowMinimize()}
        >
          {iconMin}
        </button>
        <button
          type="button"
          className="electron-tl electron-tl-close"
          title="Закрыть"
          aria-label="Закрыть"
          onClick={() => window.electronAPI.windowClose()}
        >
          {iconClose}
        </button>
      </div>
    </>
  );
}

export default ElectronTitlebar;
