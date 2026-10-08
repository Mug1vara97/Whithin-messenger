export const PUBLIC_AUTH_PATHS = new Set([
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/confirm-email',
  '/confirm-email-change',
  '/confirm-password-change',
]);

export const PUBLIC_OPEN_PATHS = new Set([
  '/birthday',
]);

export const isPublicAuthRoute = (pathname = window.location.pathname) =>
  PUBLIC_AUTH_PATHS.has(pathname);

export const isPublicOpenRoute = (pathname = window.location.pathname) =>
  PUBLIC_OPEN_PATHS.has(pathname);

export const isPublicRoute = (pathname = window.location.pathname) =>
  isPublicAuthRoute(pathname) || isPublicOpenRoute(pathname);
