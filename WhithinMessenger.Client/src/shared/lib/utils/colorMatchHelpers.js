function normalizeHexColor(color) {
  if (!color || typeof color !== 'string') return null;

  let hex = color.trim().toLowerCase();
  if (!hex.startsWith('#')) return null;

  if (hex.length === 4) {
    hex = `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
  }

  return hex.length === 7 ? hex : null;
}

/** Same solid tile + avatar color (hex), within small channel tolerance. */
export function colorsMatchForTileAvatarOutline(colorA, colorB) {
  const hexA = normalizeHexColor(colorA);
  const hexB = normalizeHexColor(colorB);
  if (!hexA || !hexB) return false;
  if (hexA === hexB) return true;

  const parse = (hex) => ({
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  });

  const a = parse(hexA);
  const b = parse(hexB);
  const threshold = 10;

  return (
    Math.abs(a.r - b.r) <= threshold &&
    Math.abs(a.g - b.g) <= threshold &&
    Math.abs(a.b - b.b) <= threshold
  );
}
