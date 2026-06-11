import { useCallStore } from '../stores/callStore';

/** Live VAD speaking map — bypasses React.memo on call tiles. */
export const useParticipantSpeakingStates = () =>
  useCallStore((state) => state.participantSpeakingStates);

export const useParticipantMuteStates = () =>
  useCallStore((state) => state.participantMuteStates);

export const useParticipantGlobalAudioStates = () =>
  useCallStore((state) => state.participantGlobalAudioStates);

export const getMapValue = (map, userId) => {
  if (!map || userId == null) return undefined;
  const key = String(userId);
  if (map.has(key)) return map.get(key);
  return map.get(userId);
};

export const getParticipantIsMuted = (muteStates, participant, localIsMuted = false) => {
  if (participant?.isCurrentUser) return Boolean(localIsMuted);
  return Boolean(getMapValue(muteStates, participant?.id) ?? participant?.isMuted ?? false);
};

export const getParticipantIsDeafened = (globalStates, participant, localIsGlobalAudioMuted = false) => {
  if (participant?.isCurrentUser) return Boolean(localIsGlobalAudioMuted);
  return Boolean(
    getMapValue(globalStates, participant?.id) ?? participant?.isGlobalAudioMuted ?? false
  );
};

export const getParticipantIsSpeaking = (
  speakingStates,
  userId,
  { isMuted = false, audioEnabled = true } = {}
) => {
  if (!userId || isMuted || audioEnabled === false) return false;
  return Boolean(getMapValue(speakingStates, userId));
};
