import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { parseDeepLink, resolveDeepLinkTarget, buildDeepLinkHref } from '../utils/deepLink';

const navigateFromTarget = (navigate, target) => {
  if (!target) return;

  switch (target.type) {
    case 'server-event':
      navigate(`/server/${target.serverId}/event/${target.eventId}`);
      break;
    case 'server-channel':
      navigate(`/server/${target.serverId}/channel/${target.channelId}`);
      break;
    case 'server':
      navigate(`/server/${target.serverId}`);
      break;
    case 'dm':
      navigate(`/channels/@me/${target.chatId}`);
      break;
    case 'qr-login':
      navigate(
        buildDeepLinkHref(
          '/qr-login',
          target.sessionId ? `session=${encodeURIComponent(target.sessionId)}` : ''
        )
      );
      break;
    case 'legacy-event':
      // Without serverId we can only stash for a later consumer.
      try {
        sessionStorage.setItem('whithin:pendingEventId', target.eventId);
      } catch {
        /* ignore */
      }
      break;
    case 'path':
      navigate(buildDeepLinkHref(target.pathname, target.search));
      break;
    default:
      break;
  }
};

/**
 * Handles custom-protocol / shell deep links and keeps HTTPS SPA routes working.
 */
export const useDeepLinkNavigation = () => {
  const navigate = useNavigate();
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;

  useEffect(() => {
    const handleUrl = (url) => {
      const parsed = parseDeepLink(url);
      if (!parsed) return;
      const target = resolveDeepLinkTarget(parsed);
      navigateFromTarget(navigateRef.current, target);
    };

    const onCustomEvent = (event) => {
      const url = event?.detail?.url || event?.detail;
      if (typeof url === 'string') handleUrl(url);
    };

    window.addEventListener('whithin:deep-link', onCustomEvent);

    const unsubscribeElectron = window.electronAPI?.onDeepLink?.((url) => {
      if (typeof url === 'string') handleUrl(url);
    });

    return () => {
      window.removeEventListener('whithin:deep-link', onCustomEvent);
      if (typeof unsubscribeElectron === 'function') unsubscribeElectron();
    };
  }, []);
};

export default useDeepLinkNavigation;
