const VIEWPORT_PADDING = 8;

export function resolveMenuMaxBottom(options = {}) {
  const padding = options.padding ?? VIEWPORT_PADDING;
  const viewportBottom = window.innerHeight - padding;

  if (options.maxBottom != null) {
    return Math.min(options.maxBottom, viewportBottom);
  }

  const selector = options.avoidSelector;
  if (!selector) {
    return viewportBottom;
  }

  const element = document.querySelector(selector);
  if (!element) {
    return viewportBottom;
  }

  const rect = element.getBoundingClientRect();
  if (rect.top <= padding || rect.top >= window.innerHeight) {
    return viewportBottom;
  }

  return Math.max(padding + 48, rect.top - padding);
}

export function clampMenuPosition(
  x,
  y,
  menuWidth,
  menuHeight,
  padding = VIEWPORT_PADDING,
  options = {},
) {
  const viewportWidth = window.innerWidth;
  const maxBottom = resolveMenuMaxBottom({ ...options, padding });

  let nextX = x;
  let nextY = y;

  if (menuWidth + padding * 2 > viewportWidth) {
    nextX = padding;
  } else if (nextX + menuWidth > viewportWidth - padding) {
    nextX = viewportWidth - menuWidth - padding;
  } else if (nextX < padding) {
    nextX = padding;
  }

  const spaceBelow = maxBottom - y;
  const spaceAbove = y - padding;

  if (menuHeight <= spaceBelow) {
    nextY = y;
  } else if (menuHeight <= spaceAbove) {
    nextY = y - menuHeight;
  } else if (menuHeight + padding * 2 > maxBottom - padding) {
    nextY = padding;
  } else {
    nextY = Math.max(padding, maxBottom - menuHeight);
  }

  if (nextY < padding) {
    nextY = padding;
  }

  return { x: nextX, y: nextY };
}

export { VIEWPORT_PADDING };
