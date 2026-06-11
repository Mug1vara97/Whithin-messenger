import { audioDeviceStorage } from './audioDeviceStorage';

export function isNoiseSuppressionSettingEnabled() {
  try {
    const saved = localStorage.getItem('noiseSuppression');
    return saved ? JSON.parse(saved) : false;
  } catch {
    return false;
  }
}

/** VB-Cable + NS in call: physical mic with NS via browser mixer; soundpad still goes to bridge for other apps. */
export function shouldUseHybridSystemCallAudio() {
  const config = audioDeviceStorage.getConfig();
  return config.soundpadMode === 'system' && isNoiseSuppressionSettingEnabled();
}

export function usesCallMixerForMic() {
  try {
    const raw = localStorage.getItem('whithinAudioDevices');
    const inApp = !raw || JSON.parse(raw).soundpadMode !== 'system';
    return inApp || shouldUseHybridSystemCallAudio();
  } catch {
    return shouldUseHybridSystemCallAudio();
  }
}

export function getPhysicalMicConstraints() {
  const { captureDeviceId } = audioDeviceStorage.getConfig();
  const audio = {
    echoCancellation: true,
    noiseSuppression: false,
    autoGainControl: true,
    sampleRate: 48000,
    channelCount: 1,
    latency: 0,
    suppressLocalAudioPlayback: true,
  };
  if (captureDeviceId) {
    audio.deviceId = { exact: captureDeviceId };
  }
  return { audio };
}
