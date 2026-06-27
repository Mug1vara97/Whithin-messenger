export const PUBLIC_AUTH_PATHS = new Set([
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/confirm-email',
  '/confirm-email-change',
  '/confirm-password-change',
]);

export const isPublicAuthRoute = (pathname = window.location.pathname) =>
  PUBLIC_AUTH_PATHS.has(pathname);
