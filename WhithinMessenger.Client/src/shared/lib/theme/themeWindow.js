export const THEME_WINDOW_NAME = 'whithin-theme-colors';

export function isThemeColorsWindow() {
  if (typeof window === 'undefined') return false;
  return (
    window.location.pathname === '/theme-colors' ||
    window.name === THEME_WINDOW_NAME
  );
}
