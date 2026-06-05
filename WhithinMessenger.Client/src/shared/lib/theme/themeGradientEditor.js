export const GRADIENT_STOP_COUNT = 6;

export const MESH_MARKER = '/*whithin-mesh*/';

/** Позиции для сферного (mesh) градиента — как на референсе с углами и центром. */
export const MESH_POINT_LAYOUT = [
  { label: 'Низ-лево', x: 0, y: 100 },
  { label: 'Верх-лево', x: 0, y: 0 },
  { label: 'Верх-право', x: 100, y: 0 },
  { label: 'Низ-право', x: 100, y: 100 },
  { label: 'Центр', x: 50, y: 50 },
  { label: 'Верх', x: 50, y: 0 },
];

/** Яркий mesh как на примере: красный / пурпурный / розовый. */
export const MESH_VIVID_PRESET = [
  { color: '#e8193a', enabled: true },
  { color: '#1a0828', enabled: true },
  { color: '#f04d8a', enabled: true },
  { color: '#4a1578', enabled: true },
  { color: '#9a1a45', enabled: true },
  { color: '#6b1a5c', enabled: false },
];

function expandHex(hex) {
  if (!hex || typeof hex !== 'string') return '#000000';
  let h = hex.trim();
  if (!h.startsWith('#')) return '#000000';
  h = h.slice(1);
  if (h.length === 3) {
    h = h
      .split('')
      .map((c) => c + c)
      .join('');
  }
  if (h.length !== 6) return '#000000';
  return `#${h.toLowerCase()}`;
}

export function collectHexes(str) {
  const m = (str || '').matchAll(/#([0-9a-f]{6}|[0-9a-f]{3})\b/gi);
  return [...m].map((x) => expandHex(`#${x[1]}`));
}

function interpolateHex(c1, c2, t) {
  const parse = (hex) => {
    const n = parseInt(expandHex(hex).slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const [r1, g1, b1] = parse(c1);
  const [r2, g2, b2] = parse(c2);
  const ratio = Math.min(1, Math.max(0, t));
  const r = Math.round(r1 + (r2 - r1) * ratio);
  const g = Math.round(g1 + (g2 - g1) * ratio);
  const b = Math.round(b1 + (b2 - b1) * ratio);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

function enabledIndicesForCount(count) {
  const n = Math.min(GRADIENT_STOP_COUNT, Math.max(1, count));
  if (n <= 1) return [0];
  return Array.from({ length: n }, (_, i) =>
    Math.round((i / (n - 1)) * (GRADIENT_STOP_COUNT - 1))
  );
}

function fillDisabledStopColors(stops, fallbackHex) {
  const enabled = stops
    .map((stop, index) => ({ ...stop, index }))
    .filter((stop) => stop.enabled);
  if (!enabled.length) {
    return stops.map((stop) => ({ ...stop, color: expandHex(fallbackHex) }));
  }
  return stops.map((stop, index) => {
    if (stop.enabled) return stop;
    const prev = [...enabled].reverse().find((item) => item.index < index);
    const next = enabled.find((item) => item.index > index);
    if (prev && next) {
      const t = (index - prev.index) / (next.index - prev.index);
      return { ...stop, color: interpolateHex(prev.color, next.color, t) };
    }
    if (prev) return { ...stop, color: prev.color };
    if (next) return { ...stop, color: next.color };
    return { ...stop, color: expandHex(fallbackHex) };
  });
}

export function createDefaultStops(fallbackHex, startHex) {
  const start = expandHex(startHex || fallbackHex);
  const end = expandHex(fallbackHex);
  const colors = expandToSixStopColors([start, end === start ? adjustHue(start) : end], fallbackHex);
  return colors.map((color, index) => ({
    color,
    enabled: index === 0 || index === GRADIENT_STOP_COUNT - 1,
  }));
}

function expandToSixStopColors(hexes, fallbackHex) {
  const source = (hexes?.length ? hexes : [fallbackHex]).map(expandHex);
  if (source.length >= GRADIENT_STOP_COUNT) return source.slice(0, GRADIENT_STOP_COUNT);
  if (source.length === 1) return Array.from({ length: GRADIENT_STOP_COUNT }, () => source[0]);
  return Array.from({ length: GRADIENT_STOP_COUNT }, (_, index) => {
    const t = index / (GRADIENT_STOP_COUNT - 1);
    const srcIndex = t * (source.length - 1);
    const lo = Math.floor(srcIndex);
    const hi = Math.min(source.length - 1, Math.ceil(srcIndex));
    if (lo === hi) return source[lo];
    return interpolateHex(source[lo], source[hi], srcIndex - lo);
  });
}

function parseLinearGradientAngle(inner) {
  let angle = 180;
  const degM = inner.match(/^(-?\d+(?:\.\d+)?)deg\s*,/i);
  if (degM) {
    angle = Math.round(parseFloat(degM[1])) % 360;
  } else {
    const head = inner.split(',')[0].toLowerCase();
    if (head.includes('to bottom right') || head.includes('to right bottom')) angle = 135;
    else if (head.includes('to top right') || head.includes('to right top')) angle = 45;
    else if (head.includes('to bottom left') || head.includes('to left bottom')) angle = 225;
    else if (head.includes('to top left') || head.includes('to left top')) angle = 315;
    else if (head.includes('to right')) angle = 90;
    else if (head.includes('to left')) angle = 270;
    else if (head.includes('to bottom')) angle = 180;
    else if (head.includes('to top')) angle = 0;
    else {
      const anyDeg = inner.match(/(-?\d+(?:\.\d+)?)deg/i);
      if (anyDeg) angle = Math.round(parseFloat(anyDeg[1])) % 360;
    }
  }
  return ((angle % 360) + 360) % 360;
}

function parseLinearGradientUi(raw, fallbackHex) {
  const s = (raw || '').trim();
  const open = /^linear-gradient\s*\(\s*(.*)\)$/i.exec(s);
  if (!open) return null;
  const inner = open[1];
  const hexes = collectHexes(inner);
  if (hexes.length < 2) return null;

  const indices = enabledIndicesForCount(hexes.length);
  const colors = expandToSixStopColors(hexes, fallbackHex);
  const stops = colors.map((color, index) => ({
    color,
    enabled: indices.includes(index),
  }));
  indices.forEach((slotIndex, colorIndex) => {
    stops[slotIndex].color = hexes[colorIndex];
    stops[slotIndex].enabled = true;
  });

  return {
    kind: 'linear',
    angle: parseLinearGradientAngle(inner),
    stops: fillDisabledStopColors(stops, fallbackHex),
  };
}

function stripMeshMarker(raw) {
  return (raw || '').trim().replace(/^\s*\/\*whithin-mesh\*\/\s*/i, '').trim();
}

function parseMeshGradientUi(raw, fallbackHex) {
  const hasMarker = /\/\*whithin-mesh\*\//i.test(raw || '');
  const s = stripMeshMarker(raw);
  if (!hasMarker && !/radial-gradient/i.test(s)) return null;
  if (/linear-gradient/i.test(s) && !hasMarker) return null;

  const radials = [];
  const re =
    /radial-gradient\s*\(\s*ellipse\s+[\d.]+%\s+[\d.]+%\s+at\s*([\d.]+)%\s+([\d.]+)%\s*,\s*(#[0-9a-f]{3,6})\s+0%/gi;
  let match;
  while ((match = re.exec(s)) !== null) {
    radials.push({
      x: parseFloat(match[1]),
      y: parseFloat(match[2]),
      color: expandHex(match[3]),
    });
  }

  if (!radials.length && !hasMarker) return null;

  const stops = MESH_POINT_LAYOUT.map((pos) => {
    const hit = radials.find(
      (radial) => Math.abs(radial.x - pos.x) <= 2 && Math.abs(radial.y - pos.y) <= 2
    );
    return {
      color: hit?.color || expandHex(fallbackHex),
      enabled: !!hit,
    };
  });

  if (hasMarker && !radials.length) {
    const hexes = collectHexes(s);
    hexes.slice(0, GRADIENT_STOP_COUNT).forEach((color, index) => {
      if (stops[index]) {
        stops[index].color = color;
        stops[index].enabled = true;
      }
    });
  }

  return { kind: 'mesh', angle: 0, stops: fillDisabledStopColors(stops, fallbackHex) };
}

export function parseGradientUi(raw, fallbackHex) {
  return parseMeshGradientUi(raw, fallbackHex) || parseLinearGradientUi(raw, fallbackHex);
}

export function buildLinearGradient(angle, stops) {
  const active = (stops || []).filter((stop) => stop.enabled);
  if (!active.length) return expandHex(stops?.[0]?.color || '#36393f');
  if (active.length === 1) return expandHex(active[0].color);

  const a = ((Math.round(Number(angle)) % 360) + 360) % 360;
  const parts = active.map((stop, index) => {
    const pct = Math.round((index / (active.length - 1)) * 100);
    return `${expandHex(stop.color)} ${pct}%`;
  });
  return `linear-gradient(${a}deg, ${parts.join(', ')})`;
}

export function buildMeshGradient(stops) {
  const active = (stops || [])
    .map((stop, index) => ({ stop, pos: MESH_POINT_LAYOUT[index] }))
    .filter(({ stop }) => stop?.enabled);

  if (!active.length) {
    return expandHex(stops?.[0]?.color || '#36393f');
  }

  const layers = active.map(
    ({ stop, pos }) =>
      `radial-gradient(ellipse 92% 82% at ${pos.x}% ${pos.y}%, ${expandHex(stop.color)} 0%, transparent 68%)`
  );
  const base = expandHex(active[active.length - 1].stop.color);
  return `${MESH_MARKER} ${layers.join(', ')}, ${base}`;
}

export function buildGradientCss(state) {
  if (!state) return '#36393f';
  if (state.kind === 'mesh') return buildMeshGradient(state.stops);
  return buildLinearGradient(state.angle, state.stops);
}

export function isAdvancedPaint(raw) {
  const s = (raw || '').trim();
  if (!s) return false;
  if (/^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(s)) return false;
  if (parseGradientUi(s, '#36393f')) return false;
  return true;
}

export function linearStopLabel(index) {
  if (GRADIENT_STOP_COUNT <= 1) return '0%';
  return `${Math.round((index / (GRADIENT_STOP_COUNT - 1)) * 100)}%`;
}

export function meshStopLabel(index) {
  return MESH_POINT_LAYOUT[index]?.label || `Точка ${index + 1}`;
}

export function convertGradientKind(state, nextKind, fallbackHex) {
  const enabledColors = state.stops.filter((stop) => stop.enabled).map((stop) => stop.color);
  const colorCount = Math.max(1, enabledColors.length);

  if (nextKind === 'mesh') {
    const stops = MESH_POINT_LAYOUT.map((_, index) => ({
      color: enabledColors[index] || enabledColors[enabledColors.length - 1] || fallbackHex,
      enabled: index < Math.min(colorCount, 4),
    }));
    return { kind: 'mesh', angle: 0, stops: fillDisabledStopColors(stops, fallbackHex) };
  }

  const indices = enabledIndicesForCount(colorCount);
  const stops = createDefaultStops(fallbackHex, enabledColors[0] || fallbackHex).map((stop, index) => {
    const colorIndex = indices.indexOf(index);
    return {
      color: colorIndex >= 0 ? enabledColors[colorIndex] : stop.color,
      enabled: indices.includes(index),
    };
  });
  return { kind: 'linear', angle: state.angle || 135, stops: fillDisabledStopColors(stops, fallbackHex) };
}

export function applyMeshPreset(preset = MESH_VIVID_PRESET) {
  return {
    kind: 'mesh',
    angle: 0,
    stops: preset.map((stop) => ({
      color: expandHex(stop.color),
      enabled: !!stop.enabled,
    })),
  };
}

/** Лёгкое смещение hex для второго стопа, если совпадает с первым. */
export function adjustHue(hex) {
  const e = expandHex(hex);
  const n = parseInt(e.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const r2 = Math.min(255, r + 40);
  const g2 = Math.min(255, g + 20);
  const b2 = Math.min(255, b + 60);
  return `#${((1 << 24) + (r2 << 16) + (g2 << 8) + b2).toString(16).slice(1)}`;
}
