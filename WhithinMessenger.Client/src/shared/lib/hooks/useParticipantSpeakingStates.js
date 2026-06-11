import { useCallStore } from '../stores/callStore';

/** Live VAD speaking map — bypasses React.memo on call tiles. */
export const useParticipantSpeakingStates = () =>
  useCallStore((state) => state.participantSpeakingStates);

export const getParticipantIsSpeaking = (speakingStates, userId, { isMuted = false, audioEnabled = true } = {}) => {
  if (!userId || isMuted || audioEnabled === false) return false;
  return speakingStates?.get(String(userId)) || false;
};
