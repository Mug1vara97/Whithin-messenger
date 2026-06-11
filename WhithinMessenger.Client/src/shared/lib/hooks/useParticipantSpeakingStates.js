import { useMemo } from 'react';
import { useCallStore } from '../stores/callStore';

/** Live VAD speaking map — bypasses React.memo on call tiles. */
export const useParticipantSpeakingStates = () =>
  useCallStore((state) => state.participantSpeakingStates);

export const useParticipantMuteStates = () =>
  useCallStore((state) => state.participantMuteStates);

export const useParticipantGlobalAudioStates = () =>
  useCallStore((state) => state.participantGlobalAudioStates);

export const useActiveVoiceChannelParticipantList = () => {
  const currentRoomId = useCallStore((state) => state.currentRoomId);
  const voiceChannelParticipants = useCallStore((state) => state.voiceChannelParticipants);

  return useMemo(() => {
    if (!currentRoomId) return [];

    const normalizedRoomId = String(currentRoomId);
    const direct =
      voiceChannelParticipants.get(currentRoomId) ||
      voiceChannelParticipants.get(normalizedRoomId);
    if (direct) return direct;

    for (const [channelKey, list] of voiceChannelParticipants.entries()) {
      if (String(channelKey) === normalizedRoomId) {
        return list;
      }
    }
    return [];
  }, [currentRoomId, voiceChannelParticipants]);
};

export const findChannelParticipant = (list, participantId) => {
  if (!list?.length || participantId == null) return null;
  const key = String(participantId);
  return (
    list.find(
      (participant) =>
        String(participant.userId || participant.odUserId || participant.id) === key
    ) || null
  );
};

export const getMapValue = (map, userId) => {
  if (!map || userId == null) return undefined;
  const key = String(userId);
  if (map.has(key)) return map.get(key);
  return map.get(userId);
};

export const getParticipantIsMuted = (
  muteStates,
  participant,
  localIsMuted = false,
  channelParticipant = null
) => {
  if (participant?.isCurrentUser) return Boolean(localIsMuted);
  if (channelParticipant && channelParticipant.isMuted !== undefined) {
    return Boolean(channelParticipant.isMuted);
  }
  const mapValue = getMapValue(muteStates, participant?.id);
  if (mapValue !== undefined) return Boolean(mapValue);
  return Boolean(participant?.isMuted ?? false);
};

export const getParticipantIsDeafened = (
  globalStates,
  participant,
  localIsGlobalAudioMuted = false,
  channelParticipant = null
) => {
  if (participant?.isCurrentUser) return Boolean(localIsGlobalAudioMuted);
  if (channelParticipant) {
    const channelDeafened =
      channelParticipant.isGlobalAudioMuted ??
      channelParticipant.isAudioDisabled ??
      channelParticipant.isDeafened;
    if (channelDeafened !== undefined) {
      return Boolean(channelDeafened);
    }
  }
  const mapValue = getMapValue(globalStates, participant?.id);
  if (mapValue !== undefined) return Boolean(mapValue);
  return Boolean(participant?.isGlobalAudioMuted ?? false);
};

export const getParticipantIsSpeaking = (
  speakingStates,
  userId,
  { isMuted = false, audioEnabled = true } = {}
) => {
  if (!userId || isMuted || audioEnabled === false) return false;
  return Boolean(getMapValue(speakingStates, userId));
};
