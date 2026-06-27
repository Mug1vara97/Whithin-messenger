import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { applyAuthPageSeo, applySiteSeo } from '../../lib/seo/siteSeo';
import { PUBLIC_AUTH_PATHS } from '../../lib/utils/authRoutes';

const AUTH_PATHS = PUBLIC_AUTH_PATHS;

export default function SeoRouteSync() {
  const { pathname } = useLocation();

  useEffect(() => {
    if (AUTH_PATHS.has(pathname)) {
      applyAuthPageSeo(pathname);
      return;
    }

    applySiteSeo({ path: pathname });
  }, [pathname]);

  return null;
}
