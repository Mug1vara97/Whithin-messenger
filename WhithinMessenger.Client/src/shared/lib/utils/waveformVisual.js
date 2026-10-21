/** Shared look + loudness→height mapping for LiveWaveform and BarWaveform. */

export const WAVEFORM_BAR_WIDTH = 3;
export const WAVEFORM_BAR_GAP = 2;
export const WAVEFORM_BAR_RADIUS = 1.5;
export const WAVEFORM_MIN_BAR_HEIGHT = 2;

/** Max bar height as a fraction of the canvas (lower = shorter bars). */
export const WAVEFORM_HEIGHT_SCALE = 0.52;

/**
 * Live analyser gain before height scale.
 * Kept modest so normal speech sits mid-height instead of clipping the canvas.
 */
export const WAVEFORM_LIVE_SENSITIVITY = 1.2;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

/**
 * Soften loudness so quiet speech stays short and loud speech doesn't slam 100%.
 * Same curve for live samples and stored peaks.
 */
export function shapeWaveformLevel(level) {
  const v = clamp(Number(level) || 0, 0, 1);
  return Math.pow(v, 0.85);
}

/** Final 0..1 height factor for a bar. */
export function waveformBarFactor(level, sensitivity = 1) {
  return clamp(shapeWaveformLevel(level) * sensitivity * WAVEFORM_HEIGHT_SCALE, 0, WAVEFORM_HEIGHT_SCALE);
}
