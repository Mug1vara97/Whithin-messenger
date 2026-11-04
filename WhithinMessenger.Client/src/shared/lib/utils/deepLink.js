const CUSTOM_SCHEMES = new Set(['whithin', 'within']);
const APP_HOSTS = new Set(['whithin.ru', 'www.whithin.ru', 'localhost', '127.0.0.1']);

const stripTrailingSlash = (path) => {
  if (!path || path === '/') return path || '/';
  return path.replace(/\/+$/, '') || '/';
};

/**
 * Parse https://whithin.ru/..., relative paths, and whithin:// / within:// URLs
 * into an in-app location { pathname, search, hash }.
 */
export const parseDeepLink = (input) => {
  if (!input || typeof input !== 'string') return null;
  const raw = input.trim();
  if (!raw) return null;

  try {
    if (CUSTOM_SCHEMES.has(raw.split(':')[0]?.toLowerCase())) {
      const asHttp = raw.replace(/^(whithin|within):\/\//i, 'https://');
      const url = new URL(asHttp);
      // whithin://qr-login?session=... → host=qr-login
      // whithin://open/server/... → host=open, pathname=/server/...
      // whithin://server/... → host=server, pathname=/...
      let pathname = url.pathname || '/';
      const host = url.hostname;

      if (host && host !== 'open' && host !== 'app') {
        pathname = stripTrailingSlash(`/${host}${pathname === '/' ? '' : pathname}`);
      } else if (host === 'open' || host === 'app') {
        pathname = stripTrailingSlash(pathname || '/');
      }

      return {
        pathname: pathname.startsWith('/') ? pathname : `/${pathname}`,
        search: url.search || '',
        hash: url.hash || '',
      };
    }

    if (raw.startsWith('/')) {
      const url = new URL(raw, 'https://whithin.ru');
      return {
        pathname: stripTrailingSlash(url.pathname),
        search: url.search || '',
        hash: url.hash || '',
      };
    }

    const url = new URL(raw);
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      if (!APP_HOSTS.has(url.hostname) && url.hostname !== window.location.hostname) {
        return null;
      }
      return {
        pathname: stripTrailingSlash(url.pathname),
        search: url.search || '',
        hash: url.hash || '',
      };
    }
  } catch {
    return null;
  }

  return null;
};

export const buildDeepLinkHref = (pathname, search = '') => {
  const path = pathname?.startsWith('/') ? pathname : `/${pathname || ''}`;
  const qs = search
    ? search.startsWith('?')
      ? search
      : `?${search}`
    : '';
  return `${path}${qs}`;
};

/** Extract navigation target from a parsed deep link. */
export const resolveDeepLinkTarget = (parsed) => {
  if (!parsed?.pathname) return null;
  const path = parsed.pathname;
  const params = new URLSearchParams(parsed.search || '');

  const eventMatch = path.match(/^\/server\/([^/]+)\/event\/([^/]+)$/i);
  if (eventMatch) {
    return { type: 'server-event', serverId: eventMatch[1], eventId: eventMatch[2] };
  }

  const channelMatch = path.match(/^\/server\/([^/]+)\/channel\/([^/]+)$/i);
  if (channelMatch) {
    return { type: 'server-channel', serverId: channelMatch[1], channelId: channelMatch[2] };
  }

  const serverMatch = path.match(/^\/server\/([^/]+)$/i);
  if (serverMatch) {
    const eventId = params.get('event');
    if (eventId) {
      return { type: 'server-event', serverId: serverMatch[1], eventId };
    }
    return { type: 'server', serverId: serverMatch[1] };
  }

  const dmMatch = path.match(/^\/channels\/@me\/([^/]+)$/i);
  if (dmMatch && dmMatch[1] !== 'friends' && dmMatch[1] !== 'feed') {
    return { type: 'dm', chatId: dmMatch[1] };
  }

  if (path === '/channels/@me' || path === '/channels/@me/friends' || path === '/channels/@me/feed') {
    return { type: 'path', pathname: path, search: parsed.search || '' };
  }

  if (path === '/qr-login') {
    return { type: 'qr-login', sessionId: params.get('session') };
  }

  // Legacy: /?event=uuid
  if ((path === '/' || path === '') && params.get('event')) {
    return { type: 'legacy-event', eventId: params.get('event') };
  }

  const authPaths = [
    '/login',
    '/register',
    '/forgot-password',
    '/reset-password',
    '/confirm-email',
    '/confirm-email-change',
    '/confirm-password-change',
  ];
  if (authPaths.includes(path) || path.startsWith('/discovery')) {
    return { type: 'path', pathname: path, search: parsed.search || '' };
  }

  return { type: 'path', pathname: path, search: parsed.search || '' };
};
