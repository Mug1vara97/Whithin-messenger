/** Half-width of the virtual room in meters (left ↔ right). */
export const SPATIAL_WORLD_HALF_WIDTH = 3;

/** Closest distance in meters (top of the 2D map). */
export const SPATIAL_DEPTH_NEAR = 0.6;

/** Farthest distance in meters (bottom edge near listener). */
export const SPATIAL_DEPTH_FAR = 9;

export const DEFAULT_SPATIAL_POSITION = { nx: 0.5, ny: 0.45 };

export function clamp01(value) {
  return Math.max(0.05, Math.min(0.95, Number(value) || 0));
}

/**
 * 2D map: X = left/right, Y = depth (top = far, bottom = near listener).
 * Maps to Web Audio 3D: +X right, -Z forward (toward listener at origin).
 */
export function mapNormToWorld(nx, ny) {
  const x = (clamp01(nx) - 0.5) * SPATIAL_WORLD_HALF_WIDTH * 2;
  const depthT = 1 - clamp01(ny);
  const z = -(SPATIAL_DEPTH_NEAR + depthT * (SPATIAL_DEPTH_FAR - SPATIAL_DEPTH_NEAR));
  return { x, y: 0, z };
}

export function configureSpatialPanner(panner) {
  panner.panningModel = 'HRTF';
  panner.distanceModel = 'inverse';
  panner.refDistance = 1.2;
  panner.maxDistance = SPATIAL_DEPTH_FAR + 2;
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
    return { nx: 0.5, ny: 0.42 };
  }
  const spread = 0.72;
  const t = index / (total - 1);
  const nx = 0.5 + (t - 0.5) * spread;
  const ny = 0.38 + (index % 2) * 0.08;
  return { nx: clamp01(nx), ny: clamp01(ny) };
}
