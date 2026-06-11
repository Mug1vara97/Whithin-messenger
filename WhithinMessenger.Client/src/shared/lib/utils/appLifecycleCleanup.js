import { BASE_URL } from '../constants/apiEndpoints';
import tokenManager from '../services/tokenManager';
import { useCallStore } from '../stores/callStore';
import { voiceCallApi } from '../../../entities/voice-call/api/voiceCallApi';
import { PRESENCE_STATUS, toBackendUserStatus } from './userStatus';

let cleanupStarted = false;

export const markUserOfflineKeepalive = (userId) => {
  if (!userId || !BASE_URL) return;

  const storageKey = `whithin:user-status:${userId}`;
  localStorage.setItem(storageKey, PRESENCE_STATUS.OFFLINE);

  const token = tokenManager.getToken();
  const url = `${BASE_URL.replace(/\/$/, '')}/api/user/status/${userId}`;

  try {
    fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(token && tokenManager.isTokenValid() ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ status: toBackendUserStatus(PRESENCE_STATUS.OFFLINE) }),
      keepalive: true,
      credentials: 'include',
    }).catch(() => {});
  } catch {
    /* ignore */
  }
};

export const leaveVoiceCallOnAppExit = () => {
  const state = useCallStore.getState();
  const roomId = state.currentRoomId;

  if (roomId && voiceCallApi.socket?.connected) {
    try {
      voiceCallApi.socket.emit('leave', { roomId });
    } catch {
      /* ignore */
    }
  }

  if (voiceCallApi.room) {
    try {
      voiceCallApi.room.disconnect();
    } catch {
      /* ignore */
    }
  }
};

export const runAppLifecycleCleanup = () => {
  if (cleanupStarted) return;
  cleanupStarted = true;

  const { currentUserId, isInCall } = useCallStore.getState();

  if (isInCall) {
    leaveVoiceCallOnAppExit();
  }

  if (currentUserId) {
    markUserOfflineKeepalive(currentUserId);
  }
};

export const resetAppLifecycleCleanupGuard = () => {
  cleanupStarted = false;
};
