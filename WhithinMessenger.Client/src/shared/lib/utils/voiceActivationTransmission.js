import { voiceCallApi } from '../../../entities/voice-call/api/voiceCallApi';
import { soundpadInAppMixer, usesInAppSoundpad } from '../soundpad/soundpadInAppMixer';
import { selectActiveServerVoiceModeration } from '../voice/serverVoiceModerationState';

export function getPublishedMicrophoneTrack(callState) {
  if (!callState) return null;

  if (usesInAppSoundpad()) {
    return soundpadInAppMixer.getMixedStream()?.getAudioTracks?.()[0] ?? null;
  }

  const processedTrack = callState.noiseSuppressionManager
    ?.getProcessedStream?.()
    ?.getAudioTracks?.()[0];
  if (processedTrack) return processedTrack;

  const localTrack = callState.localStream?.getAudioTracks?.()[0];
  if (localTrack) return localTrack;

  const audioTrack = callState.audioStream?.getAudioTracks?.()[0];
  if (audioTrack) return audioTrack;

  const liveKitTrack = voiceCallApi.getLocalAudioTrack?.();
  return liveKitTrack?.mediaStreamTrack ?? null;
}

/**
 * Gates outgoing microphone audio by voice-activity threshold (when not manually muted).
 */
export function applyVoiceActivationTransmission(callState, isSpeaking) {
  if (!callState) return;

  const manuallyMuted = Boolean(callState.isMuted);
  const { isServerMuted } = selectActiveServerVoiceModeration(callState);
  const transmitVoice = Boolean(isSpeaking) && !manuallyMuted && !isServerMuted;

  if (usesInAppSoundpad()) {
    soundpadInAppMixer.setMicMuted(manuallyMuted || isServerMuted);
    soundpadInAppMixer.setVoiceActivationOpen(transmitVoice);

    const mixedTrack = soundpadInAppMixer.getMixedStream()?.getAudioTracks?.()[0];
    if (mixedTrack) {
      mixedTrack.enabled = !isServerMuted;
    }
    return;
  }

  const track = getPublishedMicrophoneTrack(callState);
  if (track) {
    track.enabled = transmitVoice;
  }
}

export function applyVoiceActivationTransmissionFromDetector(callState) {
  const isSpeaking = callState?.localVoiceActivityDetector?.getSpeakingState?.() ?? false;
  applyVoiceActivationTransmission(callState, isSpeaking);
}
