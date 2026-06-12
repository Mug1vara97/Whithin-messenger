export const emptyServerVoiceModeration = () => ({
  isServerMuted: false,
  isServerDeafened: false,
});

export const getStoredServerVoiceModeration = (map, serverId) => {
  if (!serverId) return emptyServerVoiceModeration();
  return map?.get?.(String(serverId)) || emptyServerVoiceModeration();
};

/** Moderation applies only while in a call on that server (and optional UI server context matches). */
export const selectActiveServerVoiceModeration = (state, contextServerId = null) => {
  if (!state.isInCall || !state.currentCallServerId) {
    return emptyServerVoiceModeration();
  }

  if (
    contextServerId != null &&
    String(contextServerId) !== String(state.currentCallServerId)
  ) {
    return emptyServerVoiceModeration();
  }

  return getStoredServerVoiceModeration(
    state.serverVoiceModerationByServer,
    state.currentCallServerId
  );
};

/** Primitive selectors — safe for useCallStore without shallow compare. */
export const selectActiveServerMuted = (state, contextServerId = null) =>
  selectActiveServerVoiceModeration(state, contextServerId).isServerMuted;

export const selectActiveServerDeafened = (state, contextServerId = null) =>
  selectActiveServerVoiceModeration(state, contextServerId).isServerDeafened;
