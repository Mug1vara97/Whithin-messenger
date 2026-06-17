import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { applyAuthPageSeo, applySiteSeo } from '../../lib/seo/siteSeo';

const AUTH_PATHS = new Set([
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/confirm-email',
  '/confirm-email-change',
  '/confirm-password-change',
]);

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
