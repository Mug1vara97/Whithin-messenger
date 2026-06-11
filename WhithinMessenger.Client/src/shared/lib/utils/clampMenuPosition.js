const VIEWPORT_PADDING = 8;

export function clampMenuPosition(x, y, menuWidth, menuHeight, padding = VIEWPORT_PADDING) {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  let nextX = x;
  let nextY = y;

  if (menuWidth + padding * 2 > viewportWidth) {
    nextX = padding;
  } else if (nextX + menuWidth > viewportWidth - padding) {
    nextX = viewportWidth - menuWidth - padding;
  } else if (nextX < padding) {
    nextX = padding;
  }

  if (menuHeight + padding * 2 > viewportHeight) {
    nextY = padding;
  } else if (nextY + menuHeight > viewportHeight - padding) {
    nextY = viewportHeight - menuHeight - padding;
  } else if (nextY < padding) {
    nextY = padding;
  }

  return { x: nextX, y: nextY };
}
