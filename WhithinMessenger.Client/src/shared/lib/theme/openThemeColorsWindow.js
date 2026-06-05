const THEME_WINDOW_NAME = 'whithin-theme-colors';

let themeColorsWindow = null;

export function openThemeColorsWindow() {
  const url = new URL('/theme-colors', window.location.origin).href;

  if (themeColorsWindow && !themeColorsWindow.closed) {
    themeColorsWindow.focus();
    return themeColorsWindow;
  }

  themeColorsWindow = window.open(
    url,
    THEME_WINDOW_NAME,
    [
      'width=580',
      'height=860',
      'menubar=no',
      'toolbar=no',
      'location=no',
      'status=no',
      'resizable=yes',
      'scrollbars=yes',
    ].join(','),
  );

  if (!themeColorsWindow) {
    window.location.assign(url);
    return null;
  }

  return themeColorsWindow;
}
