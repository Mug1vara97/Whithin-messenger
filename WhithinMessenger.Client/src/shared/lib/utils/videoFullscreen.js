const FULLSCREEN_EVENTS = [
  'fullscreenchange',
  'webkitfullscreenchange',
  'mozfullscreenchange',
  'MSFullscreenChange',
];

const FIT_PROPS = ['position', 'top', 'left', 'right', 'bottom', 'transform', 'width', 'height', 'max-width', 'max-height', 'margin'];

export const clearVideoFit = (video) => {
  if (!video) return;
  FIT_PROPS.forEach((prop) => video.style.removeProperty(prop));
};

/** Size the element to the frame and center it. object-fit on a full-size video sticks to the top. */
export const fitVideoInBox = (video, box) => {
  if (!video || !box) return;
  const frameWidth = video.videoWidth;
  const frameHeight = video.videoHeight;
  const boxWidth = box.clientWidth;
  const boxHeight = box.clientHeight;
  if (!frameWidth || !frameHeight || !boxWidth || !boxHeight) return;

  const scale = Math.min(boxWidth / frameWidth, boxHeight / frameHeight);
  const width = Math.max(1, Math.floor(frameWidth * scale));
  const height = Math.max(1, Math.floor(frameHeight * scale));

  video.style.setProperty('position', 'absolute', 'important');
  video.style.setProperty('top', '50%', 'important');
  video.style.setProperty('left', '50%', 'important');
  video.style.setProperty('right', 'auto', 'important');
  video.style.setProperty('bottom', 'auto', 'important');
  video.style.setProperty('transform', 'translate(-50%, -50%)', 'important');
  video.style.setProperty('width', `${width}px`, 'important');
  video.style.setProperty('height', `${height}px`, 'important');
  video.style.setProperty('max-width', 'none', 'important');
  video.style.setProperty('max-height', 'none', 'important');
  video.style.setProperty('margin', '0', 'important');
};

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
