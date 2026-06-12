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

const resolveParticipantUserId = (participant, channelParticipant = null) =>
  participant?.id ??
  participant?.userId ??
  channelParticipant?.userId ??
  channelParticipant?.odUserId ??
  null;

export const getParticipantIsMuted = (
  muteStates,
  participant,
  localIsMuted = false,
  channelParticipant = null
) => {
  if (channelParticipant?.isServerMuted) return true;
  if (participant?.isCurrentUser) return Boolean(localIsMuted);

  const userId = resolveParticipantUserId(participant, channelParticipant);
  const mapValue = getMapValue(muteStates, userId);
  if (mapValue !== undefined) return Boolean(mapValue);

  if (channelParticipant && channelParticipant.isMuted !== undefined) {
    return Boolean(channelParticipant.isMuted);
  }
  return Boolean(participant?.isMuted ?? false);
};

export const getParticipantIsDeafened = (
  globalStates,
  participant,
  localIsGlobalAudioMuted = false,
  channelParticipant = null
) => {
  if (channelParticipant?.isServerDeafened) return true;
  if (participant?.isCurrentUser) return Boolean(localIsGlobalAudioMuted);

  const userId = resolveParticipantUserId(participant, channelParticipant);
  const mapValue = getMapValue(globalStates, userId);
  if (mapValue !== undefined) return Boolean(mapValue);

  if (channelParticipant) {
    const channelDeafened =
      channelParticipant.isGlobalAudioMuted ??
      channelParticipant.isAudioDisabled ??
      channelParticipant.isDeafened;
    if (channelDeafened !== undefined) {
      return Boolean(channelDeafened);
    }
  }
  return Boolean(participant?.isGlobalAudioMuted ?? false);
};

export const getParticipantIsServerMuted = (
  channelParticipant,
  { isCurrentUser = false, localIsServerMuted = false } = {}
) => (isCurrentUser ? Boolean(localIsServerMuted) : Boolean(channelParticipant?.isServerMuted));

export const getParticipantIsServerDeafened = (
  channelParticipant,
  { isCurrentUser = false, localIsServerDeafened = false } = {}
) => (isCurrentUser ? Boolean(localIsServerDeafened) : Boolean(channelParticipant?.isServerDeafened));

export const getParticipantIsSpeaking = (
  speakingStates,
  userId,
  { isMuted = false, audioEnabled = true, channelParticipant = null } = {}
) => {
  if (!userId || isMuted || audioEnabled === false) return false;

  const mapValue = getMapValue(speakingStates, userId);
  if (mapValue !== undefined) return Boolean(mapValue);

  if (channelParticipant?.isSpeaking !== undefined) {
    return Boolean(channelParticipant.isSpeaking);
  }

  return false;
};
