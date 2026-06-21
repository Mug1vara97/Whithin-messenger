import { BASE_URL } from '../constants/apiEndpoints';
import tokenManager from '../services/tokenManager';

export const inviteUserToServer = async (serverId, userId) => {
  const normalizedServerId = serverId != null ? String(serverId).trim() : '';
  const normalizedUserId = userId != null ? String(userId).trim() : '';

  if (!normalizedServerId || !normalizedUserId) {
    throw new Error('Не указан сервер или пользователь');
  }

  const token = tokenManager.getToken();
  const response = await fetch(`${BASE_URL}/api/server/${normalizedServerId}/add-member`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ userId: normalizedUserId }),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    if (response.status === 403) {
      throw new Error(payload.error || 'Недостаточно прав для приглашения на сервер');
    }
    throw new Error(payload.error || 'Не удалось пригласить на сервер');
  }
};
