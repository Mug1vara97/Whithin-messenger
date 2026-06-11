import { volumeStorage } from './volumeStorage';

const OUTPUT_GAIN_MIN = 0.5;
const OUTPUT_GAIN_MAX = 2.5;
/** Default call output boost (~40% louder) with limiter to avoid harsh clipping. */
export const DEFAULT_CALL_OUTPUT_GAIN = 1.4;

export function getCallOutputGain() {
  const stored = volumeStorage.getOutputVolume();
  let gain = stored > 0 ? stored : DEFAULT_CALL_OUTPUT_GAIN;
  // Migrate older installs that saved 1.0 as "max" before the output boost existed.
  if (gain === 1) {
    gain = DEFAULT_CALL_OUTPUT_GAIN;
  }
  return Math.max(OUTPUT_GAIN_MIN, Math.min(OUTPUT_GAIN_MAX, gain));
}

export function ensureCallMasterOutputBus(audioContext, existing = {}) {
  if (!audioContext || audioContext.state === 'closed') {
    return null;
  }

  let { masterGain, masterCompressor } = existing;

  if (!masterGain || masterGain.context !== audioContext) {
    masterGain = audioContext.createGain();
    masterCompressor = audioContext.createDynamicsCompressor();
    masterCompressor.threshold.setValueAtTime(-20, audioContext.currentTime);
    masterCompressor.knee.setValueAtTime(24, audioContext.currentTime);
    masterCompressor.ratio.setValueAtTime(3, audioContext.currentTime);
    masterCompressor.attack.setValueAtTime(0.003, audioContext.currentTime);
    masterCompressor.release.setValueAtTime(0.22, audioContext.currentTime);
    masterGain.connect(masterCompressor);
    masterCompressor.connect(audioContext.destination);
  }

  masterGain.gain.setValueAtTime(getCallOutputGain(), audioContext.currentTime);
  return { masterGain, masterCompressor };
}

export function applyCallMasterOutputGain(audioContext, masterGain) {
  if (!audioContext || !masterGain || masterGain.context !== audioContext) return;
  masterGain.gain.setValueAtTime(getCallOutputGain(), audioContext.currentTime);
}

export function disconnectCallMasterOutputBus(existing = {}) {
  try {
    existing.masterGain?.disconnect();
  } catch {
    // ignore
  }
  try {
    existing.masterCompressor?.disconnect();
  } catch {
    // ignore
  }
}
