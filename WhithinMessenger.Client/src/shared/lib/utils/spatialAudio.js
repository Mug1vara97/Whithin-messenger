/** Half-width of the virtual room in meters (left ↔ right). */
export const SPATIAL_WORLD_HALF_WIDTH = 4;

/** Half-depth in meters (front ↔ behind listener). */
export const SPATIAL_WORLD_HALF_DEPTH = 4;

/** Closest distance to listener in meters. */
export const SPATIAL_DEPTH_NEAR = 0.8;

/** Listener marker on the 2D map (center). */
export const SPATIAL_MAP_CENTER = { nx: 0.5, ny: 0.5 };

export const DEFAULT_SPATIAL_POSITION = { nx: 0.5, ny: 0.28 };

const MAP_EDGE_MARGIN = 0.08;
const MAP_MIN_RADIUS = 0.12;

export function clamp01(value) {
  return Math.max(0.05, Math.min(0.95, Number(value) || 0));
}

/**
 * Top-down map centered on listener.
 * nx: left ↔ right, ny: front (top) ↔ behind (bottom).
 */
export function clampNormFromCenter(nx, ny) {
  let cx = Math.max(MAP_EDGE_MARGIN, Math.min(1 - MAP_EDGE_MARGIN, Number(nx) || 0.5));
  let cy = Math.max(MAP_EDGE_MARGIN, Math.min(1 - MAP_EDGE_MARGIN, Number(ny) || 0.5));

  const dx = cx - SPATIAL_MAP_CENTER.nx;
  const dy = cy - SPATIAL_MAP_CENTER.ny;
  const dist = Math.hypot(dx, dy);

  if (dist < MAP_MIN_RADIUS) {
    if (dist < 0.001) {
      cx = SPATIAL_MAP_CENTER.nx;
      cy = SPATIAL_MAP_CENTER.ny - MAP_MIN_RADIUS;
    } else {
      const scale = MAP_MIN_RADIUS / dist;
      cx = SPATIAL_MAP_CENTER.nx + dx * scale;
      cy = SPATIAL_MAP_CENTER.ny + dy * scale;
    }
  }

  return { nx: cx, ny: cy };
}

/**
 * Maps 2D radar coords to Web Audio 3D: +X right, -Z forward, +Z behind.
 */
export function mapNormToWorld(nx, ny) {
  const { nx: cx, ny: cy } = clampNormFromCenter(nx, ny);
  const dx = (cx - SPATIAL_MAP_CENTER.nx) * 2;
  const dy = (cy - SPATIAL_MAP_CENTER.ny) * 2;
  const x = dx * SPATIAL_WORLD_HALF_WIDTH;
  const z = dy * SPATIAL_WORLD_HALF_DEPTH;
  return { x, y: 0, z };
}

export function worldDistanceFromNorm(nx, ny) {
  const { x, z } = mapNormToWorld(nx, ny);
  return Math.hypot(x, z);
}

export function configureSpatialPanner(panner) {
  panner.panningModel = 'HRTF';
  panner.distanceModel = 'inverse';
  panner.refDistance = 1.2;
  panner.maxDistance =
    Math.hypot(SPATIAL_WORLD_HALF_WIDTH, SPATIAL_WORLD_HALF_DEPTH) * 2 + 2;
  panner.rolloffFactor = 1.15;
  panner.coneInnerAngle = 360;
  panner.coneOuterAngle = 360;
  panner.coneOuterGain = 1;
}

export function applyPannerWorldPosition(panner, nx, ny) {
  const { x, y, z } = mapNormToWorld(nx, ny);
  if (panner.positionX) {
    panner.positionX.value = x;
    panner.positionY.value = y;
    panner.positionZ.value = z;
  } else {
    panner.setPosition(x, y, z);
  }
}

export function ensureSpatialListener(audioContext) {
  if (!audioContext?.listener) return;

  const listener = audioContext.listener;
  if (listener.positionX) {
    listener.positionX.value = 0;
    listener.positionY.value = 0;
    listener.positionZ.value = 0;
    listener.forwardX.value = 0;
    listener.forwardY.value = 0;
    listener.forwardZ.value = -1;
    listener.upX.value = 0;
    listener.upY.value = 1;
    listener.upZ.value = 0;
  } else {
    listener.setPosition(0, 0, 0);
    listener.setOrientation(0, 0, -1, 0, 1, 0);
  }
}

export function defaultPositionForIndex(index, total) {
  if (total <= 1) {
    return clampNormFromCenter(DEFAULT_SPATIAL_POSITION.nx, DEFAULT_SPATIAL_POSITION.ny);
  }

  const spread = Math.PI * 1.35;
  const startAngle = -spread / 2;
  const angle = startAngle + (index / Math.max(total - 1, 1)) * spread;
  const radius = 0.2 + (index % 2) * 0.04;
  const nx = SPATIAL_MAP_CENTER.nx + Math.sin(angle) * radius;
  const ny = SPATIAL_MAP_CENTER.ny - Math.cos(angle) * radius;
  return clampNormFromCenter(nx, ny);
}
