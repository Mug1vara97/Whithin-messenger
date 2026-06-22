const FULLSCREEN_EVENTS = [
  'fullscreenchange',
  'webkitfullscreenchange',
  'mozfullscreenchange',
  'MSFullscreenChange',
];

export const getFullscreenElement = () =>
  document.fullscreenElement ||
  document.webkitFullscreenElement ||
  document.mozFullScreenElement ||
  document.msFullscreenElement ||
  null;

export const requestElementFullscreen = async (element) => {
  if (!element) return false;

  try {
    if (element.requestFullscreen) {
      await element.requestFullscreen({ navigationUI: 'hide' });
      return true;
    }

    if (element.webkitRequestFullscreen) {
      element.webkitRequestFullscreen(Element.ALLOW_KEYBOARD_INPUT);
      return true;
    }

    if (element.mozRequestFullScreen) {
      await element.mozRequestFullScreen();
      return true;
    }

    if (element.msRequestFullscreen) {
      await element.msRequestFullscreen();
      return true;
    }
  } catch {
    return false;
  }

  return false;
};

export const exitDocumentFullscreen = async () => {
  try {
    if (document.exitFullscreen) {
      await document.exitFullscreen();
      return true;
    }

    if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
      return true;
    }

    if (document.mozCancelFullScreen) {
      document.mozCancelFullScreen();
      return true;
    }

    if (document.msExitFullscreen) {
      document.msExitFullscreen();
      return true;
    }
  } catch {
    return false;
  }

  return false;
};

export const subscribeFullscreenChange = (handler) => {
  FULLSCREEN_EVENTS.forEach((eventName) => {
    document.addEventListener(eventName, handler);
  });

  return () => {
    FULLSCREEN_EVENTS.forEach((eventName) => {
      document.removeEventListener(eventName, handler);
    });
  };
};

export const isElementFullscreen = (element) => {
  const active = getFullscreenElement();
  if (!active || !element) return false;
  return active === element || element.contains(active) || active.contains(element);
};

/*
 * --- Custom Electron / pseudo fullscreen (disabled; HTML Fullscreen API only) ---
 *
 * const PINNED_STYLE_PROPS = [...];
 * export const mountNodeToBody = ...
 * export const captureMessagesScrollAnchor = ...
 * export const pinElectronFullscreenOverlay = ...
 * export const enterElectronOsVideoFullscreen = ...
 * export const exitElectronOsVideoFullscreen = ...
 * export const blockNativeVideoFullscreen = ...
 * See git history for full implementation.
 */
