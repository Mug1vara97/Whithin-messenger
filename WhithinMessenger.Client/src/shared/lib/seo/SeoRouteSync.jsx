import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { applyAuthPageSeo, applySiteSeo } from '../../lib/seo/siteSeo';
import { PUBLIC_AUTH_PATHS, PUBLIC_OPEN_PATHS } from '../../lib/utils/authRoutes';

const AUTH_PATHS = PUBLIC_AUTH_PATHS;

export default function SeoRouteSync() {
  const { pathname } = useLocation();

  useEffect(() => {
    if (AUTH_PATHS.has(pathname)) {
      applyAuthPageSeo(pathname);
      return;
    }

    if (PUBLIC_OPEN_PATHS.has(pathname)) {
      applySiteSeo({
        title: 'С днём рождения',
        path: pathname,
        robots: 'noindex, nofollow',
      });
      return;
    }

    applySiteSeo({ path: pathname });
  }, [pathname]);

  return null;
}
