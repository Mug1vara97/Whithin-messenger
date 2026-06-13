import { BASE_URL } from '../constants/apiEndpoints';
import {
  findChannelParticipant,
  getParticipantIsDeafened,
  getParticipantIsMuted,
  getParticipantIsServerDeafened,
  getParticipantIsServerMuted,
  getParticipantIsSpeaking,
} from '../hooks/useParticipantSpeakingStates';
import { selectActiveServerVoiceModeration } from '../voice/serverVoiceModerationState';
import {
  getActiveCallOverlayEnabled,
  getActiveCallOverlayCoords,
} from './activeCallOverlaySettings';
import { getNotificationPosition } from './inAppNotificationSettings';
import { getDesktopNotificationTheme } from './desktopNotificationBridge';
import { shouldShowDesktopOverlayWhenInBackground } from './desktopCallOverlayBridge';
import { getOverlayStatusIcons } from './overlayStatusIcons';

export function isElectronActiveCallOverlayAvailable() {
  return typeof window !== 'undefined' && Boolean(window.electronAPI?.showActiveCallOverlay);
}

function resolveAvatarUrl(url) {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  const base = BASE_URL.replace(/\/$/, '');
  const path = url.startsWith('/') ? url : `/${url}`;
  return `${base}${path}`;
}

function getVoiceChannelList(state) {
  const roomId = state.currentRoomId;
  if (!roomId) return [];

  const normalizedRoomId = String(roomId);
  const direct =
    state.voiceChannelParticipants.get(roomId) ||
    state.voiceChannelParticipants.get(normalizedRoomId);

  if (direct) return direct;

  for (const [channelKey, list] of state.voiceChannelParticipants.entries()) {
    if (String(channelKey) === normalizedRoomId) {
      return list;
    }
  }

  return [];
}

function buildParticipantView({
  userId,
  name,
  avatar,
  avatarColor,
  isCurrentUser,
  participant,
  channelParticipant,
  state,
  serverModeration,
}) {
  const isMuted = getParticipantIsMuted(
    state.participantMuteStates,
    { id: userId, userId, isCurrentUser, ...participant },
    state.isMuted,
    channelParticipant,
  );
  const isDeafened = getParticipantIsDeafened(
    state.participantGlobalAudioStates,
    { id: userId, userId, isCurrentUser, ...participant },
    state.isGlobalAudioMuted,
    channelParticipant,
  );
  const isSpeaking = getParticipantIsSpeaking(state.participantSpeakingStates, userId, {
    isMuted,
    channelParticipant,
  });
  const isServerMuted = getParticipantIsServerMuted(channelParticipant, {
    isCurrentUser,
    localIsServerMuted: serverModeration.isServerMuted,
  });
  const isServerDeafened = getParticipantIsServerDeafened(channelParticipant, {
    isCurrentUser,
    localIsServerDeafened: serverModeration.isServerDeafened,
  });

  return {
    userId: String(userId),
    name: name || 'Unknown',
    avatarUrl: resolveAvatarUrl(avatar),
    avatarColor: avatarColor || '#5865F2',
    isCurrentUser: Boolean(isCurrentUser),
    isMuted,
    isDeafened,
    isSpeaking,
    isServerMuted,
    isServerDeafened,
  };
}

export function buildActiveCallOverlayView(state, authUser) {
  if (!state?.isInCall || !state.currentRoomId) return null;

  const channelParticipants = getVoiceChannelList(state);
  const currentUserId = String(authUser?.id || state.currentUserId || '');
  const serverModeration = selectActiveServerVoiceModeration(state);
  const seen = new Set();
  const participants = [];

  const addParticipant = (rawUserId, data = {}) => {
    if (rawUserId == null || rawUserId === '') return;
    const userId = String(rawUserId);
    if (seen.has(userId)) return;
    seen.add(userId);

    const channelParticipant = findChannelParticipant(channelParticipants, userId);
    const webrtcParticipant = state.participants.find(
      (entry) => String(entry.userId || entry.id) === userId,
    );
    const isCurrentUser = userId === currentUserId;

    participants.push(
      buildParticipantView({
        userId,
        name:
          data.name ||
          channelParticipant?.userName ||
          channelParticipant?.username ||
          channelParticipant?.name ||
          webrtcParticipant?.name ||
          webrtcParticipant?.userName ||
          'Unknown',
        avatar:
          data.avatar ??
          channelParticipant?.avatar ??
          webrtcParticipant?.avatar ??
          null,
        avatarColor:
          data.avatarColor ||
          channelParticipant?.avatarColor ||
          webrtcParticipant?.avatarColor ||
          '#5865F2',
        isCurrentUser,
        participant: webrtcParticipant,
        channelParticipant,
        state,
        serverModeration,
      }),
    );
  };

  if (currentUserId) {
    addParticipant(currentUserId, {
      name: authUser?.username || state.currentUserName || 'You',
      avatar: authUser?.avatar || null,
      avatarColor: authUser?.avatarColor || '#5865F2',
    });
  }

  channelParticipants.forEach((channelParticipant) => {
    addParticipant(
      channelParticipant.userId || channelParticipant.odUserId || channelParticipant.id,
      {
        name: channelParticipant.userName || channelParticipant.username || channelParticipant.name,
        avatar: channelParticipant.avatar,
        avatarColor: channelParticipant.avatarColor,
      },
    );
  });

  state.participants.forEach((participant) => {
    addParticipant(participant.userId || participant.id, {
      name: participant.name || participant.userName,
      avatar: participant.avatar,
      avatarColor: participant.avatarColor,
    });
  });

  if (!participants.length) return null;

  participants.sort((a, b) => {
    if (a.isCurrentUser) return -1;
    if (b.isCurrentUser) return 1;
    return a.name.localeCompare(b.name, 'ru');
  });

  const channelName =
    state.currentCall?.channelName ||
    state.currentCall?.roomName ||
    state.currentCall?.chatName ||
    'Голосовой канал';

  return {
    channelId: String(state.currentRoomId),
    channelName,
    participants,
  };
}

export function shouldShowDesktopActiveCallOverlay(state, visibility) {
  if (!getActiveCallOverlayEnabled()) return false;
  if (!state?.isInCall || !state?.currentRoomId) return false;
  return shouldShowDesktopOverlayWhenInBackground(visibility);
}

export function syncDesktopActiveCallOverlayTheme() {
  if (!isElectronActiveCallOverlayAvailable() || !window.electronAPI.syncActiveCallOverlayTheme) return;
  window.electronAPI.syncActiveCallOverlayTheme({
    ...getDesktopNotificationTheme(),
    icons: getOverlayStatusIcons(),
  });
}

export function syncDesktopActiveCallOverlaySettings() {
  if (!isElectronActiveCallOverlayAvailable() || !window.electronAPI.syncActiveCallOverlaySettings) {
    return;
  }

  window.electronAPI.syncActiveCallOverlaySettings({
    coords: getActiveCallOverlayCoords(),
    notificationPosition: getNotificationPosition(),
  });
}

export function showDesktopActiveCallOverlay(payload) {
  if (!isElectronActiveCallOverlayAvailable() || !payload) return;
  syncDesktopActiveCallOverlayTheme();
  syncDesktopActiveCallOverlaySettings();
  window.electronAPI.showActiveCallOverlay(payload);
}

export function updateDesktopActiveCallOverlay(payload) {
  if (!isElectronActiveCallOverlayAvailable() || !payload) return;
  window.electronAPI.updateActiveCallOverlay?.(payload);
}

export function dismissDesktopActiveCallOverlay() {
  if (!isElectronActiveCallOverlayAvailable()) return;
  window.electronAPI.dismissActiveCallOverlay?.();
}
