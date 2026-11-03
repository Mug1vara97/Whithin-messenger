import { volumeStorage } from './volumeStorage';
import { applyCallMasterOutputGain } from './callAudioMasterBus';
import { applyVoiceActivationTransmissionFromDetector } from './voiceActivationTransmission';

const MIC_THRESHOLD_MIN = 0;
const MIC_THRESHOLD_MAX = 200;
/** Input gain at 100% mic volume — reference for threshold compensation. */
export const INPUT_GAIN_AT_FULL_VOLUME = 2;

export function getInputGainMultiplier(inputVolume) {
  const volume = inputVolume ?? volumeStorage.getInputVolume();
  return Math.max(0.1, Math.min(5, volume * INPUT_GAIN_AT_FULL_VOLUME));
}

/** Mic volume scales the signal after capture; compensate so sensitivity stays consistent. */
export function getEffectiveMicThreshold(baseThreshold, inputVolume) {
  const stored = Math.max(0, Math.min(255, Number(baseThreshold) || 0));
  const gain = getInputGainMultiplier(inputVolume);
  return Math.max(0, Math.min(255, Math.round(stored * (INPUT_GAIN_AT_FULL_VOLUME / gain))));
}

export function sensitivityToMicThreshold(sensitivity) {
  const normalized = Math.max(0, Math.min(100, Number(sensitivity) || 0));
  return Math.round(
    MIC_THRESHOLD_MAX - (normalized / 100) * (MIC_THRESHOLD_MAX - MIC_THRESHOLD_MIN),
  );
}

export function micThresholdToSensitivity(threshold) {
  const value = Math.max(MIC_THRESHOLD_MIN, Math.min(MIC_THRESHOLD_MAX, Number(threshold) || 14));
  return Math.round(((MIC_THRESHOLD_MAX - value) / (MIC_THRESHOLD_MAX - MIC_THRESHOLD_MIN)) * 100);
}

export function micThresholdToNoiseGateOpenDb(threshold) {
  const value = Math.max(0, Math.min(255, Number(threshold) || 14));
  return -38 - (value / 255) * 47;
}

/**
 * Build mic constraints for getUserMedia / LiveKit.
 * Avoid hard-pinning sampleRate/channelCount/latency — Focusrite/USB interfaces
 * often fail with NotReadableError when Chromium cannot satisfy exact formats.
 */
export function getAudioInputMediaConstraints(extra = {}, options = {}) {
  const { strictDevice = true, minimal = false } = options;
  const settings = volumeStorage.getSettings();
  const savedNoiseSuppression = localStorage.getItem('noiseSuppression');
  const wantsNoiseSuppression = savedNoiseSuppression ? JSON.parse(savedNoiseSuppression) : false;
  const echoOn = !minimal && settings.echoCancellation !== false;
  const agcOn = !minimal && settings.autoGainControl !== false;

  const audio = {
    echoCancellation: echoOn,
    noiseSuppression: !minimal && wantsNoiseSuppression,
    autoGainControl: agcOn,
    ...extra,
  };

  if (echoOn) {
    Object.assign(audio, {
      googEchoCancellation: true,
      googHighpassFilter: true,
    });
  }

  if (agcOn) {
    audio.googAutoGainControl = true;
  }

  if (!minimal && wantsNoiseSuppression) {
    audio.googNoiseSuppression = true;
  }

  const deviceId = settings.inputDeviceId;
  if (deviceId && deviceId !== 'default') {
    audio.deviceId = strictDevice ? { exact: deviceId } : { ideal: deviceId };
  }

  return { audio };
}

/** LiveKit AudioCaptureOptions from current voice settings. */
export function getLiveKitAudioCaptureOptions(options = {}) {
  const { audio } = getAudioInputMediaConstraints({}, options);
  const capture = {
    echoCancellation: audio.echoCancellation !== false,
    noiseSuppression: Boolean(audio.noiseSuppression),
    autoGainControl: audio.autoGainControl !== false,
  };
  if (audio.deviceId) {
    capture.deviceId = audio.deviceId;
  }
  return capture;
}

export async function applyLiveMicCaptureConstraints(callState) {
  const track = callState?.localStream?.getAudioTracks?.()?.[0]
    || callState?.audioStream?.getAudioTracks?.()?.[0];
  if (!track || track.readyState === 'ended') {
    return;
  }

  const { audio } = getAudioInputMediaConstraints();
  try {
    await track.applyConstraints(audio);
  } catch (error) {
    console.warn('[voice] Failed to apply mic capture constraints:', error);
  }
}

export async function applyAudioContextSinkId(audioContext, deviceId) {
  if (!audioContext || typeof audioContext.setSinkId !== 'function') {
    return false;
  }

  const sinkId = !deviceId || deviceId === 'default' ? '' : deviceId;
  try {
    await audioContext.setSinkId(sinkId);
    return true;
  } catch {
    return false;
  }
}

export function getInputGainMultiplierFromStorage() {
  return getInputGainMultiplier(volumeStorage.getInputVolume());
}

export async function applyOutputAudioDevice(deviceId, audioElements = []) {
  if (typeof HTMLMediaElement.prototype.setSinkId !== 'function') {
    return;
  }

  const sinkId = !deviceId || deviceId === 'default' ? '' : deviceId;
  const elements = audioElements instanceof Map ? audioElements.values() : audioElements;

  for (const element of elements) {
    if (!element) continue;
    try {
      await element.setSinkId(sinkId);
    } catch {
      // Device may be unavailable until the next playback.
    }
  }
}

export async function applyCallPlaybackRouting(callState) {
  if (!callState) return;

  const outputDeviceId = volumeStorage.getOutputDeviceId();
  await applyAudioContextSinkId(callState.audioContext, outputDeviceId);
  await applyOutputAudioDevice(outputDeviceId, callState.audioElements);
}

export async function applyLiveVoiceCallSettings(callState) {
  if (!callState) return;

  const inputGain = getInputGainMultiplierFromStorage();
  callState.noiseSuppressionManager?.setMicrophoneGain?.(inputGain);

  const baseThreshold = volumeStorage.getMicThreshold();
  const effectiveThreshold = getEffectiveMicThreshold(baseThreshold);
  callState.localVoiceActivityDetector?.setThreshold?.(effectiveThreshold);
  callState.noiseSuppressionManager?.setNoiseGateThreshold?.(
    micThresholdToNoiseGateOpenDb(baseThreshold),
  );

  applyCallMasterOutputGain(
    callState.audioContext,
    callState.masterOutputGain || callState.masterGain,
  );

  applyVoiceActivationTransmissionFromDetector(callState);

  await applyLiveMicCaptureConstraints(callState);
  await applyCallPlaybackRouting(callState);
}
